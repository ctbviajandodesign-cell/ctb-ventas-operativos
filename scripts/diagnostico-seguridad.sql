-- DIAGNÓSTICO DE SEGURIDAD — SOLO LECTURA (no modifica nada)
-- Pegar completo en Supabase > SQL Editor > Run, y copiar el resultado.
select 'POLITICA' as tipo, tablename as objeto,
       policyname || ' | ' || cmd || ' | roles=' || array_to_string(roles, ',') ||
       ' | USING=' || coalesce(qual,'-') || ' | CHECK=' || coalesce(with_check,'-') as detalle
from pg_policies where schemaname = 'public'
union all
select 'RLS', c.relname, case when c.relrowsecurity then 'RLS ACTIVADO' else '⚠️ RLS DESACTIVADO' end
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
union all
select 'FK', tc.table_name,
       kcu.column_name || ' -> ' || ccu.table_name || ' | ON DELETE ' || rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
union all
select 'FILAS', relname, n_live_tup::text from pg_stat_user_tables where schemaname = 'public'
union all
select 'TRIGGER', event_object_table, trigger_name || ' | ' || event_manipulation || ' | ' || action_statement
from information_schema.triggers where trigger_schema = 'public'
union all
select 'COLUMNAS', table_name, string_agg(column_name, ', ' order by ordinal_position)
from information_schema.columns where table_schema = 'public' group by table_name
order by 1, 2;
