from django.conf import settings
from django.db import models


class Category(models.Model):
    """Group of services: Photocopy, Printing, Scanning, ID Package..."""
    name = models.CharField(max_length=60, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Service(models.Model):
    """A service you offer (Photocopy, Tarpaulin, ID printing...). Add new ones anytime."""
    name = models.CharField(max_length=100, unique=True)
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL)
    unit = models.CharField(max_length=30, default="piece")      # page, piece, sq ft...
    price = models.DecimalField(max_digits=10, decimal_places=2)  # default selling price per unit
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # your cost per unit
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Sale(models.Model):
    """One availed service. Price and cost are copied at the time of sale,
    so changing a price later never alters past profit."""
    service = models.ForeignKey(Service, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)
    customer = models.CharField(max_length=100, blank=True)
    handled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def total(self):
        return self.unit_price * self.quantity

    @property
    def profit(self):
        return (self.unit_price - self.unit_cost) * self.quantity

    class Meta:
        ordering = ["-created_at"]
