
CREATE POLICY "Allow anon select titulares" ON public.titulares FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon select dependentes" ON public.dependentes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon select mensalidades" ON public.mensalidades FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon select coparticipacoes" ON public.coparticipacoes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon select coparticipacao_itens" ON public.coparticipacao_itens FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon select uploads" ON public.uploads FOR SELECT TO anon USING (true);
