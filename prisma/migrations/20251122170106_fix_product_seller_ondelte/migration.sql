-- DropForeignKey
ALTER TABLE "public"."products" DROP CONSTRAINT "products_sellerId_fkey";

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
