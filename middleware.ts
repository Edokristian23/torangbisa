export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    /*
     * Jangan jalankan middleware untuk:
     * - asset Next.js
     * - image optimizer
     * - favicon
     * - semua file static umum
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2|ttf)$).*)",
  ],
};