CREATE POLICY "Anon can delete registros_ponto"
ON public.registros_ponto
FOR DELETE
TO anon
USING (true);