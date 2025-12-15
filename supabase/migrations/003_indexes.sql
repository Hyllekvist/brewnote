create index if not exists idx_products_kind on products(kind);
create index if not exists idx_products_slug on products(slug);
create index if not exists idx_variants_product on product_variants(product_id);
create index if not exists idx_brews_user on brews(user_id);
create index if not exists idx_ratings_product on ratings(product_id);
