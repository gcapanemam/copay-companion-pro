
CREATE POLICY "Anon can delete chat_mensagens" ON public.chat_mensagens FOR DELETE TO anon USING (true);
CREATE POLICY "Anon can delete chat_mensagem_status" ON public.chat_mensagem_status FOR DELETE TO anon USING (true);
