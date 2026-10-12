import csv
from decimal import Decimal
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import Product, Dealer


class Command(BaseCommand):
    help = "Load data/catalogue.csv and data/dealers.csv into the database idempotently."

    def handle(self, *args, **options):
        data_dir = getattr(settings, "DATA_DIR", Path(settings.BASE_DIR) / "data")
        catalogue_path = data_dir / "catalogue.csv"
        dealers_path = data_dir / "dealers.csv"

        if not catalogue_path.exists():
            self.stderr.write(self.style.ERROR(f"Catalogue file not found at {catalogue_path}"))
            return
        if not dealers_path.exists():
            self.stderr.write(self.style.ERROR(f"Dealers file not found at {dealers_path}"))
            return

        self.stdout.write(f"Seeding data from {data_dir}...")

        # 1. Seed Products from catalogue.csv
        products_created = 0
        products_updated = 0
        with open(catalogue_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            with transaction.atomic():
                for row in reader:
                    sku = row["sku"].strip()
                    price = Decimal(str(row["price"]).strip())
                    stock = int(str(row["stock"]).strip())
                    _, created = Product.objects.update_or_create(
                        sku=sku,
                        defaults={
                            "name": row["name"].strip(),
                            "category": row["category"].strip(),
                            "brand": row["brand"].strip(),
                            "vehicle_fitment": row["vehicle_fitment"].strip(),
                            "price": price,
                            "stock": stock,
                            "description": row.get("description", "").strip(),
                        },
                    )
                    if created:
                        products_created += 1
                    else:
                        products_updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Products seeded: {products_created} created, {products_updated} updated (total: {Product.objects.count()})"
            )
        )

        # 2. Seed Dealers from dealers.csv
        dealers_created = 0
        dealers_updated = 0
        with open(dealers_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            with transaction.atomic():
                for row in reader:
                    dealer_code = row["dealer_code"].strip()
                    credit_limit = Decimal(str(row["credit_limit"]).strip()) if row.get("credit_limit") else Decimal("0.00")
                    _, created = Dealer.objects.update_or_create(
                        dealer_code=dealer_code,
                        defaults={
                            "name": row["name"].strip(),
                            "city": row.get("city", "").strip(),
                            "phone": row.get("phone", "").strip(),
                            "email": row.get("email", "").strip(),
                            "gstin": row.get("gstin", "").strip(),
                            "credit_limit": credit_limit,
                        },
                    )
                    if created:
                        dealers_created += 1
                    else:
                        dealers_updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Dealers seeded: {dealers_created} created, {dealers_updated} updated (total: {Dealer.objects.count()})"
            )
        )
