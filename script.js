// Aguarda o DOM estar completamente carregado
document.addEventListener('DOMContentLoaded', function() {
    // Elementos do formulário
    const form = document.getElementById('timeCapsuteForm');
    const nameInput = document.getElementById('name');
    const messageInput = document.getElementById('message');
    const datetimeInput = document.getElementById('datetime');
    const imageInput = document.getElementById('image');
    const imagePreview = document.getElementById('imagePreview');
    const clearFormBtn = document.getElementById('clearForm');
    const successMessage = document.getElementById('successMessage');

    // Define data mínima como agora
    setMinDateTime();

    // Event Listeners
    form.addEventListener('submit', handleFormSubmit);
    imageInput.addEventListener('change', handleImageUpload);
    clearFormBtn.addEventListener('click', clearForm);

    // Define a data e hora mínima como o momento atual
    function setMinDateTime() {
        const now = new Date();
        // Adiciona 1 minuto à data atual para evitar problemas de timezone
        now.setMinutes(now.getMinutes() + 1);
        
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        const minDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        datetimeInput.min = minDateTime;
    }

    // Manipula o envio do formulário
    function handleFormSubmit(e) {
        e.preventDefault();

        // Validação dos campos
        if (!validateForm()) {
            return;
        }

        // Coleta os dados do formulário
        const formData = collectFormData();

        // Simula o salvamento (por enquanto só mostra mensagem de sucesso)
        saveTimeCapsule(formData);
    }

    // Valida todos os campos do formulário
    function validateForm() {
        let isValid = true;
        const errors = [];

        // Valida nome
        if (!nameInput.value.trim()) {
            errors.push('Nome é obrigatório');
            highlightError(nameInput);
            isValid = false;
        } else {
            removeError(nameInput);
        }

        // Valida mensagem
        if (!messageInput.value.trim()) {
            errors.push('Mensagem é obrigatória');
            highlightError(messageInput);
            isValid = false;
        } else if (messageInput.value.trim().length < 10) {
            errors.push('Mensagem deve ter pelo menos 10 caracteres');
            highlightError(messageInput);
            isValid = false;
        } else {
            removeError(messageInput);
        }

        // Valida data e hora
        if (!datetimeInput.value) {
            errors.push('Data e hora são obrigatórias');
            highlightError(datetimeInput);
            isValid = false;
        } else {
            const selectedDate = new Date(datetimeInput.value);
            const now = new Date();
            
            if (selectedDate <= now) {
                errors.push('A data deve ser no futuro');
                highlightError(datetimeInput);
                isValid = false;
            } else {
                removeError(datetimeInput);
            }
        }

        // Valida imagem (se fornecida)
        if (imageInput.files.length > 0) {
            const file = imageInput.files[0];
            const maxSize = 5 * 1024 * 1024; // 5MB
            
            if (file.size > maxSize) {
                errors.push('Imagem deve ter no máximo 5MB');
                highlightError(imageInput);
                isValid = false;
            } else if (!file.type.startsWith('image/')) {
                errors.push('Arquivo deve ser uma imagem');
                highlightError(imageInput);
                isValid = false;
            } else {
                removeError(imageInput);
            }
        }

        // Mostra erros se houver
        if (!isValid) {
            showErrors(errors);
        }

        return isValid;
    }

    // Coleta todos os dados do formulário
    function collectFormData() {
        const formData = {
            name: nameInput.value.trim(),
            message: messageInput.value.trim(),
            datetime: datetimeInput.value,
            image: null,
            timestamp: new Date().toISOString()
        };

        // Se há imagem, converte para base64
        if (imageInput.files.length > 0) {
            const file = imageInput.files[0];
            formData.image = {
                name: file.name,
                size: file.size,
                type: file.type,
                file: file
            };
        }

        return formData;
    }

    // Manipula o upload de imagem
    function handleImageUpload(e) {
        const file = e.target.files[0];
        
        if (file) {
            // Valida o arquivo
            if (!file.type.startsWith('image/')) {
                alert('Por favor, selecione apenas arquivos de imagem.');
                e.target.value = '';
                return;
            }

            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                alert('A imagem deve ter no máximo 5MB.');
                e.target.value = '';
                return;
            }

            // Cria preview da imagem
            const reader = new FileReader();
            reader.onload = function(e) {
                showImagePreview(e.target.result, file);
            };
            reader.readAsDataURL(file);
        } else {
            clearImagePreview();
        }
    }

    // Mostra preview da imagem
    function showImagePreview(imageSrc, file) {
        const fileSize = (file.size / 1024 / 1024).toFixed(2);
        
        imagePreview.innerHTML = `
            <img src="${imageSrc}" alt="Preview da imagem">
            <div class="preview-info">
                <strong>${file.name}</strong><br>
                Tamanho: ${fileSize} MB
            </div>
        `;
    }

    // Remove o preview da imagem
    function clearImagePreview() {
        imagePreview.innerHTML = '';
    }

    // Salva a cápsula do tempo (simulação)
    function saveTimeCapsule(data) {
        // Simula um delay de salvamento
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Salvando...';

        setTimeout(() => {
            // Esconde o formulário
            form.style.display = 'none';
            
            // Mostra mensagem de sucesso
            successMessage.classList.remove('hidden');
            
            // Log dos dados para desenvolvimento
            console.log('Dados da Cápsula do Tempo:', data);
            
            // Reseta o botão após 3 segundos
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '🔒 Criar Cápsula do Tempo';
            }, 3000);
            
        }, 2000);
    }

    // Limpa o formulário
    function clearForm() {
        if (confirm('Tem certeza que deseja limpar todos os campos?')) {
            form.reset();
            clearImagePreview();
            successMessage.classList.add('hidden');
            form.style.display = 'flex';
            removeAllErrors();
        }
    }

    // Destaca campo com erro
    function highlightError(element) {
        element.style.borderColor = '#e74c3c';
        element.style.backgroundColor = '#fdf2f2';
    }

    // Remove destaque de erro
    function removeError(element) {
        element.style.borderColor = '#e1e5e9';
        element.style.backgroundColor = '#fafbfc';
    }

    // Remove todos os erros visuais
    function removeAllErrors() {
        const inputs = form.querySelectorAll('input, textarea');
        inputs.forEach(removeError);
    }

    // Mostra lista de erros
    function showErrors(errors) {
        alert('Por favor, corrija os seguintes erros:\n\n' + errors.join('\n'));
    }

    // Adiciona animação de entrada
    setTimeout(() => {
        document.querySelector('.container').style.opacity = '1';
        document.querySelector('.container').style.transform = 'translateY(0)';
    }, 100);
});

// Estilos dinâmicos para animação inicial
document.querySelector('.container').style.opacity = '0';
document.querySelector('.container').style.transform = 'translateY(20px)';
document.querySelector('.container').style.transition = 'all 0.6s ease';