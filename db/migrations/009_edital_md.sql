-- Texto do edital em Markdown, guardado com a ficha para reler sem baixar o PDF de novo. Aditiva.
alter table fichas_edital add column if not exists edital_md text;
