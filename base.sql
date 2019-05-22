select * from productos;

INSERT INTO productos(codi_prod,nomb_prod,desc_prod)
SELECT id,md5(random()::text), md5(random()::text)
FROM generate_series(1,200)id;
