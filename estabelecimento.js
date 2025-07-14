document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO FIREBASE ---
    const firebaseConfig = {
      apiKey: "AIzaSyAg0DdzFPBnGyEe_aLhVIwU5Ksljd0jTkY", // SUA CHAVE DE API
      authDomain: "smart-point-pdv-ed911.firebaseapp.com",
      projectId: "smart-point-pdv-ed911",
    };

    // --- CONFIGURAÇÃO CLOUDINARY ---
    const CLOUDINARY_CONFIG = {
        cloudName: 'di8i6rgcy',      // Seu cloud name do Cloudinary
        uploadPreset: 'Unsigned', // Seu upload preset (deve ser do tipo "Unsigned")
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
    // A variável 'storage' foi removida, pois não é mais necessária.

    // --- VARIÁVEIS DE ESTADO ---
    let currentUser = null;
    let establishmentDocId = null;

    // --- ELEMENTOS DO DOM ---
    const form = document.getElementById('establishment-form');
    const statusMessage = document.getElementById('status-message');
    const saveBtn = document.getElementById('save-btn');
    
    const inputs = {
        tradeName: document.getElementById('tradeName'),
        corporateName: document.getElementById('corporateName'),
        cnpj: document.getElementById('cnpj'),
        address: document.getElementById('address'),
        phone: document.getElementById('phone'),
        logoUrl: document.getElementById('logo-url'),
        bannerUrl: document.getElementById('banner-url')
    };

    const imageElements = {
        logo: {
            input: document.getElementById('logo-input'),
            preview: document.getElementById('logo-preview'),
            selectBtn: document.querySelector('button[data-for="logo-input"]')
        },
        banner: {
            input: document.getElementById('banner-input'),
            preview: document.getElementById('banner-preview'),
            selectBtn: document.querySelector('button[data-for="banner-input"]')
        }
    };

    // --- NOVA FUNÇÃO DE UPLOAD PARA O CLOUDINARY ---
    async function uploadImageToCloudinary(file, folder) {
        if (!file) throw new Error("Nenhum arquivo selecionado.");

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', folder);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData,
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Erro no upload para o Cloudinary.');
        }

        const data = await response.json();
        return data.secure_url; // Retorna a URL segura da imagem
    }

    // --- FUNÇÃO ATUALIZADA PARA USAR CLOUDINARY ---
    async function handleImageUpload(e, imageType) {
        const file = e.target.files[0];
        if (!file) return;

        setStatus(`Enviando ${imageType}...`, 'loading');
        saveBtn.disabled = true;

        try {
            const folder = imageType === 'logo' ? 'logos_estabelecimentos' : 'banners_estabelecimentos';
            const downloadURL = await uploadImageToCloudinary(file, folder);

            console.log('URL do Cloudinary:', downloadURL);
            inputs[`${imageType}Url`].value = downloadURL;
            imageElements[imageType].preview.src = downloadURL;
            setStatus(`${imageType.charAt(0).toUpperCase() + imageType.slice(1)} enviado com sucesso!`, 'success');

        } catch (error) {
            console.error(`Erro no upload do ${imageType}:`, error);
            setStatus(`Falha no upload: ${error.message}`, 'error');
        } finally {
            saveBtn.disabled = false;
        }
    }

    // --- DEMAIS FUNÇÕES (sem grandes alterações) ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadEstablishmentInfo();
        } else {
            console.log("Nenhum usuário logado.");
            form.style.opacity = '0.5';
            saveBtn.disabled = true;
        }
    });

    async function loadEstablishmentInfo() {
        if (!currentUser) return;
        setStatus('Carregando...', 'loading');
        try {
            const querySnapshot = await db.collection('establishment')
                .where('ownerId', '==', currentUser.uid).limit(1).get();
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                establishmentDocId = doc.id;
                const data = doc.data();
                for (const key in inputs) {
                    if (inputs[key] && data[key]) {
                        inputs[key].value = data[key];
                    }
                }
                imageElements.logo.preview.src = data.logo || 'https://via.placeholder.com/150?text=Logo';
                imageElements.banner.preview.src = data.banner || 'https://via.placeholder.com/300x100?text=Banner';
                setStatus('Informações carregadas.', 'success');
            } else {
                setStatus('Nenhuma informação encontrada. Preencha para salvar.', 'loading');
            }
        } catch (error) {
            console.error("Erro ao carregar informações:", error);
            setStatus('Erro ao carregar dados.', 'error');
        }
    }

    async function saveEstablishmentInfo(e) {
        e.preventDefault();
        if (!currentUser) return;

        setStatus('Salvando...', 'loading');
        saveBtn.disabled = true;

        const dataToSave = {
            ownerId: currentUser.uid,
            tradeName: inputs.tradeName.value.trim(),
            corporateName: inputs.corporateName.value.trim(),
            cnpj: inputs.cnpj.value.trim(),
            address: inputs.address.value.trim(),
            phone: inputs.phone.value.trim(),
            logoUrl: inputs.logoUrl.value,
            bannerUrl: inputs.bannerUrl.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (establishmentDocId) {
                await db.collection('establishment').doc(establishmentDocId).set(dataToSave, { merge: true });
            } else {
                const newDocRef = await db.collection('establishment').add(dataToSave);
                establishmentDocId = newDocRef.id;
            }
            setStatus('Informações salvas com sucesso!', 'success');
            setTimeout(() => setStatus('', ''), 3000);
        } catch (error) {
            console.error("Erro ao salvar:", error);
            setStatus('Erro ao salvar as informações.', 'error');
        } finally {
            saveBtn.disabled = false;
        }
    }
    
    function setStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = type;
    }

    // --- EVENT LISTENERS ---
    form.addEventListener('submit', saveEstablishmentInfo);
    imageElements.logo.selectBtn.addEventListener('click', () => imageElements.logo.input.click());
    imageElements.logo.input.addEventListener('change', (e) => handleImageUpload(e, 'logo'));
    imageElements.banner.selectBtn.addEventListener('click', () => imageElements.banner.input.click());
    imageElements.banner.input.addEventListener('change', (e) => handleImageUpload(e, 'banner'));
});