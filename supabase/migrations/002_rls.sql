alter table profiles enable row level security;
alter table brews enable row level security;
alter table ratings enable row level security;
alter table inventory enable row level security;
alter table wishlist enable row level security;
alter table gear enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "brews_select_own" on brews for select using (auth.uid() = user_id);
create policy "brews_insert_own" on brews for insert with check (auth.uid() = user_id);
create policy "brews_update_own" on brews for update using (auth.uid() = user_id);
create policy "brews_delete_own" on brews for delete using (auth.uid() = user_id);

create policy "ratings_select_own" on ratings for select using (auth.uid() = user_id);
create policy "ratings_insert_own" on ratings for insert with check (auth.uid() = user_id);
create policy "ratings_update_own" on ratings for update using (auth.uid() = user_id);
create policy "ratings_delete_own" on ratings for delete using (auth.uid() = user_id);

create policy "inventory_select_own" on inventory for select using (auth.uid() = user_id);
create policy "inventory_insert_own" on inventory for insert with check (auth.uid() = user_id);
create policy "inventory_update_own" on inventory for update using (auth.uid() = user_id);
create policy "inventory_delete_own" on inventory for delete using (auth.uid() = user_id);

create policy "wishlist_select_own" on wishlist for select using (auth.uid() = user_id);
create policy "wishlist_insert_own" on wishlist for insert with check (auth.uid() = user_id);
create policy "wishlist_delete_own" on wishlist for delete using (auth.uid() = user_id);

create policy "gear_select_own" on gear for select using (auth.uid() = user_id);
create policy "gear_insert_own" on gear for insert with check (auth.uid() = user_id);
create policy "gear_update_own" on gear for update using (auth.uid() = user_id);
create policy "gear_delete_own" on gear for delete using (auth.uid() = user_id);

alter table products enable row level security;
alter table product_variants enable row level security;
create policy "products_public_read" on products for select using (true);
create policy "variants_public_read" on product_variants for select using (true);
