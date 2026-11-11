-- Lets one delivery note (GDN) hold products from several LPOs of the same project.
-- Each item records the LPO it came from. gdns.lpo_id keeps the first LPO for older screens.
alter table gdn_items add column if not exists lpo_id uuid references lpos(id);

update gdn_items gi
   set lpo_id = g.lpo_id
  from gdns g
 where gi.gdn_id = g.id
   and gi.lpo_id is null;
