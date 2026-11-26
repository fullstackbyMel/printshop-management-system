from datetime import datetime, timedelta
from django.contrib.auth import authenticate
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.utils import timezone
from rest_framework import permissions, serializers, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Category, Sale, Service


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.is_staff


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


class ServiceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)

    class Meta:
        model = Service
        fields = ["id", "name", "category", "category_name", "unit", "price", "cost", "is_active"]
        extra_kwargs = {"category": {"required": True, "allow_null": False}}

    def to_representation(self, obj):
        data = super().to_representation(obj)
        if not self.context["request"].user.is_staff:
            data.pop("cost")  # in-charge staff never see your costs
        return data


class SaleSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    category_name = serializers.CharField(source="service.category.name", read_only=True, default=None)
    handled_by_name = serializers.CharField(source="handled_by.username", read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    class Meta:
        model = Sale
        fields = ["id", "service", "service_name", "category_name", "quantity", "unit_price", "total",
                  "customer", "handled_by_name", "created_at"]

    def validate_service(self, s):
        if not s.is_active:
            raise serializers.ValidationError("This service is no longer offered.")
        return s

    def create(self, validated):
        service = validated["service"]
        validated.setdefault("unit_price", service.price)
        validated["unit_cost"] = service.cost
        validated["handled_by"] = self.context["request"].user
        return super().create(validated)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    http_method_names = ["get", "post", "patch"]


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Service.objects.order_by("name")
        return qs if self.request.user.is_staff else qs.filter(is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False  # keep history; just hide it
        instance.save()


class SaleViewSet(viewsets.ModelViewSet):
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        qs = Sale.objects.select_related("service", "handled_by")
        if not self.request.user.is_staff:
            qs = qs.filter(handled_by=self.request.user)
        return qs[:200]

    def destroy(self, request, *a, **kw):
        if not request.user.is_staff:
            return Response({"detail": "Only the admin can delete a sale."}, status=403)
        return super().destroy(request, *a, **kw)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login(request):
    user = authenticate(username=request.data.get("username", "").strip(),
                        password=request.data.get("password", ""))
    if not user:
        return Response({"detail": "Wrong username or password."}, status=400)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "username": user.username, "is_admin": user.is_staff})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def report(request):
    """Admin only. ?start=YYYY-MM-DD&end=YYYY-MM-DD (both optional, end day included)."""
    if not request.user.is_staff:
        return Response({"detail": "Admin only."}, status=403)
    qs = Sale.objects.all()
    try:
        if request.GET.get("start"):
            qs = qs.filter(created_at__gte=timezone.make_aware(datetime.strptime(request.GET["start"], "%Y-%m-%d")))
        if request.GET.get("end"):
            end = datetime.strptime(request.GET["end"], "%Y-%m-%d") + timedelta(days=1)
            qs = qs.filter(created_at__lt=timezone.make_aware(end))
    except ValueError:
        return Response({"detail": "Invalid date."}, status=400)
    money = DecimalField(max_digits=14, decimal_places=2)
    rows = (qs.values("service__name", "service__category__name")
              .annotate(orders=Count("id"), qty=Sum("quantity"),
                        revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=money)),
                        cost=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"), output_field=money)))
              .order_by("service__name"))
    out = [{"service": r["service__name"], "category": r["service__category__name"],
            "orders": r["orders"], "quantity": r["qty"], "revenue": r["revenue"], "cost": r["cost"],
            "profit": r["revenue"] - r["cost"]} for r in rows]
    out.sort(key=lambda r: r["profit"], reverse=True)
    totals = {k: sum(r[k] for r in out) for k in ("orders", "quantity", "revenue", "cost", "profit")}
    return Response({"rows": out, "totals": totals})
