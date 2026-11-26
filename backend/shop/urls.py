from django.urls import include, path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")
router.register("services", views.ServiceViewSet, basename="service")
router.register("sales", views.SaleViewSet, basename="sale")

urlpatterns = [
    path("login/", views.login),
    path("report/", views.report),
    path("", include(router.urls)),
]
