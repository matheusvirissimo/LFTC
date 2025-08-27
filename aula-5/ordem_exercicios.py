# Lista com 39 itens (substitua por seus próprios itens, se necessário)
itens = list(range(1, 9))  # [1, 2, 3, ..., 8]

# Distribuição intercalada em três listas: k, m, k
p = itens[0::3]  # itens nas posições 0, 3, 6, ...
m = itens[1::3]  # itens nas posições 1, 4, 7, ...
k = itens[2::3]  # itens nas posições 2, 5, 8, ...

# Exemplo de saída
print("p: L", p)
print("m: L", m)
print("k: L", k)