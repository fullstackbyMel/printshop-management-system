from django.db import models

from django.conf import settings

# Create your models here.
class Service(models.Model):
    name = models.CharField(max_length=100, unique=True)
    unit = models.CharField(max_length=30, default="piece")      
    price = models.DecimalField(max_digits=10, decimal_places=2)  
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0) 
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Sale(models.Model):
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
