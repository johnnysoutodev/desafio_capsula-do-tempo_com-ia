# 📅 Cápsula do Tempo

Sistema completo de cápsula do tempo que permite enviar mensagens para o futuro com agendamento automático. O projeto consiste em um front-end responsivo e um back-end Node.js com API REST.

## 🌟 Visão Geral

A **Cápsula do Tempo** é uma aplicação que permite aos usuários criarem mensagens especiais para serem "abertas" em uma data e hora específicas no futuro. Cada cápsula contém:

- **Nome do usuário**
- **E-mail para contato** 
- **Mensagem personalizada** (até 140 caracteres - estilo Twitter clássico)
- **Data e hora para abertura**
- **Imagem obrigatória** (memória visual)

## 🚀 Demo

**Front-end em Produção:** Link para seu deploy da Vercel [aqui](https://desafio-capsula-do-tempo-com-ia.vercel.app)

## ✨ Funcionalidades do Front-end

### 📝 Formulário Inteligente
- **Validação em tempo real** de todos os campos
- **Contador de caracteres** dinâmico para mensagens
- **Preview instantâneo** da imagem carregada
- **Design responsivo** para desktop e mobile

### 🔍 Validações Implementadas

| Campo | Validações |
|-------|------------|
| **Nome** | Obrigatório, 2-50 caracteres, apenas letras e espaços |
| **E-mail** | Obrigatório, formato válido, máximo 100 caracteres |
| **Mensagem** | Obrigatório, 10-140 caracteres (estilo Twitter clássico) |
| **Data/Hora** | Obrigatório, deve ser no futuro, máximo 10 anos |
| **Imagem** | Obrigatório, formatos: JPEG/PNG/GIF/WebP, 1KB-5MB |

### 🎨 Interface
- **Design moderno** com gradientes e animações
- **Feedback visual** para erros e sucessos
- **Experiência mobile-first**
- **Loading states** e transições suaves

## 🛠️ Tecnologias Utilizadas

### Front-end
- **HTML5** - Estrutura semântica
- **CSS3** - Estilos responsivos com gradientes e animações
- **JavaScript** (Vanilla) - Funcionalidades e validações
- **Vercel** - Deploy e hospedagem

### Back-end (Em desenvolvimento)
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **Multer** - Upload de arquivos
- **Node-cron** - Agendamento de tarefas
- **Nodemailer** - Envio de e-mails

## 📁 Estrutura do Projeto

```
desafio_capsula-do-tempo_com-ia/
├── frontend/
│   └── public/
│       ├── index.html      # Página principal
│       ├── styles.css      # Estilos responsivos
│       └── script.js       # Funcionalidades JS
├── backend/                # Em desenvolvimento
├── .github/
│   └── workflows/
│       └── deploy-frontend.yml  # Deploy automático
├── vercel.json            # Configuração Vercel
├── package.json           # Dependências e scripts
└── README.md             # Documentação
```

## 🚀 Como Usar o Front-end

### 1. Acesso Online
Visite o link de produção: **[Inserir URL da Vercel aqui]**

### 2. Preenchimento do Formulário

1. **Digite seu nome completo** (apenas letras e espaços)
2. **Informe um e-mail válido** (será usado para notificações futuras)
3. **Escreva sua mensagem** (máximo 140 caracteres):
   - Use o contador visual para acompanhar
   - Seja criativo e conciso!
4. **Selecione data e hora futuras** (até 10 anos à frente)
5. **Faça upload de uma imagem** (obrigatório):
   - Formatos aceitos: JPEG, PNG, GIF, WebP
   - Tamanho: entre 1KB e 5MB
   - Preview instantâneo será exibido

### 3. Validação Automática
- ✅ **Verde**: Campo preenchido corretamente
- ⚠️ **Amarelo**: Aviso (ex: contador de caracteres)
- ❌ **Vermelho**: Erro que precisa ser corrigido

### 4. Envio
Clique em **"🔒 Criar Cápsula do Tempo"** e aguarde a confirmação!

## 💻 Desenvolvimento Local

### Pré-requisitos
- Node.js 18+ instalado
- Git configurado
- Conta na Vercel (para deploy)

### Instalação
```bash
# 1. Clonar o repositório
git clone https://github.com/johnnysoutodev/desafio_capsula-do-tempo_com-ia.git
cd desafio_capsula-do-tempo_com-ia

# 2. Instalar dependências
npm install

# 3. Executar localmente (via Vercel Dev)
npm run dev:frontend

# 4. Acessar no browser
# http://localhost:3000
```

### Scripts Disponíveis
```bash
npm run deploy:frontend     # Deploy para produção
npm run deploy:preview      # Deploy de preview
npm run dev:frontend        # Servidor local
npm run security:audit      # Auditoria de segurança
```

## 🚀 Deploy

O projeto utiliza **deploy automático** via GitHub Actions:

1. **Push para main** → Triggera deploy automático
2. **Vercel** faz o build e hospedagem
3. **URL única** gerada para cada deploy

### Configuração do Deploy
- **Plataforma**: Vercel
- **Framework**: Static Site
- **Diretório raiz**: `frontend/public/`
- **Build**: Não necessário (arquivos estáticos)

## 🔧 Configurações

### Validações Personalizáveis
No arquivo `frontend/public/script.js`, você pode ajustar:

```javascript
// Limites de caracteres
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 140;

// Tamanho de imagem
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_IMAGE_SIZE = 1024; // 1KB

// Limite de tempo futuro
const MAX_YEARS_AHEAD = 10;
```

## 🎯 Roadmap

### ✅ Concluído
- [x] Interface responsiva e moderna
- [x] Validações completas do formulário
- [x] Upload e preview de imagens
- [x] Deploy automático na Vercel
- [x] Contador de caracteres estilo Twitter

### 🔄 Em Desenvolvimento
- [ ] API Backend Node.js
- [ ] Sistema de agendamento
- [ ] Envio de e-mails programados
- [ ] Banco de dados para persistência
- [ ] Sistema de autenticação

### 🚀 Futuro
- [ ] Notificações push
- [ ] Galeria de cápsulas públicas
- [ ] Compartilhamento social
- [ ] Aplicativo mobile

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Add: nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC. Veja o arquivo `LICENSE` para mais detalhes.

## 👨‍💻 Autor

**Johnny Souto**
- GitHub: [@johnnysoutodev](https://github.com/johnnysoutodev)
- LinkedIn: [Seu LinkedIn aqui]

---

⭐ **Gostou do projeto? Deixe uma estrela!**
