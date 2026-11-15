-- Active: 1794619610398@@127.0.0.1@3306
-- SOLO datos ficticios para DESARROLLO en base recién creada, nunca datos reales.
USE colegio_san_miguel_pos;

START TRANSACTION;

INSERT INTO
    products (
        id,
        name,
        category,
        description
    )
VALUES (
        1,
        'Playera polo escolar',
        'Uniforme diario',
        'Ejemplo ficticio'
    ),
    (
        2,
        'Pantalón escolar',
        'Uniforme diario',
        'Ejemplo ficticio'
    ),
    (
        3,
        'Suéter escolar',
        'Uniforme invierno',
        'Ejemplo ficticio'
    );

INSERT INTO
    product_variants (
        id,
        product_id,
        size_label,
        color,
        sku,
        unit_price_cents,
        stock,
        minimum_stock
    )
VALUES (
        1,
        1,
        '6',
        'Blanco',
        'DEMO-POLO-6',
        25000,
        12,
        3
    ),
    (
        2,
        1,
        '8',
        'Blanco',
        'DEMO-POLO-8',
        25000,
        6,
        3
    ),
    (
        3,
        1,
        '10',
        'Blanco',
        'DEMO-POLO-10',
        28000,
        2,
        3
    ),
    (
        4,
        2,
        '8',
        'Azul',
        'DEMO-PANT-8',
        39000,
        9,
        2
    ),
    (
        5,
        3,
        'M',
        'Azul',
        'DEMO-SUET-M',
        46000,
        4,
        2
    );

INSERT INTO
    stock_movements (
        variant_id,
        kind,
        quantity_delta,
        stock_after,
        reason
    )
VALUES (
        1,
        'ENTRY',
        12,
        12,
        'Carga demo inicial'
    ),
    (
        2,
        'ENTRY',
        6,
        6,
        'Carga demo inicial'
    ),
    (
        3,
        'ENTRY',
        2,
        2,
        'Carga demo inicial'
    ),
    (
        4,
        'ENTRY',
        9,
        9,
        'Carga demo inicial'
    ),
    (
        5,
        'ENTRY',
        4,
        4,
        'Carga demo inicial'
    );

COMMIT;