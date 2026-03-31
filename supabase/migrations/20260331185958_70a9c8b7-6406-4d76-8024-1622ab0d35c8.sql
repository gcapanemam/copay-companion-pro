
CREATE POLICY "Allow anon delete titulares" ON public.titulares FOR DELETE TO anon USING (true);
CREATE POLICY "Allow anon delete dependentes" ON public.dependentes FOR DELETE TO anon USING (true);
CREATE POLICY "Allow anon delete mensalidades" ON public.mensalidades FOR DELETE TO anon USING (true);
CREATE POLICY "Allow anon delete coparticipacoes" ON public.coparticipacoes FOR DELETE TO anon USING (true);
CREATE POLICY "Allow anon delete coparticipacao_itens" ON public.coparticipacao_itens FOR DELETE TO anon USING (true);
CREATE POLICY "Allow anon delete uploads" ON public.uploads FOR DELETE TO anon USING (true);
