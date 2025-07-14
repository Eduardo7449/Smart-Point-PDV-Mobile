// produtos.js
let sidebarOpen = false;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.getElementById('mainContent');
    sidebarOpen = !sidebarOpen;
    if (sidebarOpen) {
        if(sidebar) sidebar.classList.add('open');
        if(overlay) overlay.classList.add('active');
        if (window.innerWidth > 768 && mainContent) mainContent.classList.add('shifted');
    } else {
        closeSidebar();
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.getElementById('mainContent');

    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (mainContent) mainContent.classList.remove('shifted');
    sidebarOpen = false;
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        if (item.getAttribute('href') === '#' || !item.getAttribute('href')) {
             e.preventDefault();
        }
        if (window.innerWidth <= 768 && sidebarOpen) {
             closeSidebar();
        }
    });
});

window.addEventListener('resize', () => {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    if (window.innerWidth <= 768) {
        mainContent.classList.remove('shifted');
    } else if (sidebarOpen) {
        mainContent.classList.add('shifted');
    }
});

const firebaseConfig = {
  apiKey: "AIzaSyAg0DdzFPBnGyEe_aLhVIwU5Ksljd0jTkY",
  authDomain: "smart-point-pdv-ed911.firebaseapp.com",
  databaseURL: "https://smart-point-pdv-ed911-default-rtdb.firebaseio.com",
  projectId: "smart-point-pdv-ed911",
  storageBucket: "smart-point-pdv-ed911.appspot.com",
  messagingSenderId: "308482043681",
  appId: "1:308482043681:web:0505c90795b9151e7b9860"
};

// Configuração do Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'di8i6rgcy', 
    uploadPreset: 'Unsigned',
    apiKey: '89774687531643', 
    folder: 'produtos'
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Elementos do Modal
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const modalTitle = document.getElementById('modalTitle');
const productIdInput = document.getElementById('productId');
const productNameInput = document.getElementById('productName');
// const productDescriptionInput = document.getElementById('productDescription'); // Removido da lógica de salvar, mas pode existir no form
const productPriceInput = document.getElementById('productPrice');
const productCategorySelect = document.getElementById('productCategorySelect');
const productStockInput = document.getElementById('productStock');
const productImageInput = document.getElementById('productImage');
const imagePreview = document.getElementById('imagePreview');
const productEanInput = document.getElementById('productEan'); // Assumindo que este input existe no seu HTML com id="productEan"

// --- Autenticação e Carregamento Inicial ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await displayStoreName(db, auth);
        await loadProducts(user.uid);
        updateUserPlanDisplay(user);
        updateLastLoginTime();
    } else {
        window.location.href = '/login.html';
    }
});

function logout() {
    auth.signOut().then(() => {
        window.location.href = '/login.html';
    }).catch((error) => {
        console.error("Erro ao sair:", error);
    });
}
const logoutButton = document.getElementById('logoutButton');
if (logoutButton) {
    logoutButton.addEventListener('click', logout);
}

async function displayStoreName(database, authInstance) {
    const storeNameElement = document.getElementById('storeNameElement');
    const storeLogoElement = document.getElementById('storeLogoElement');
    if (storeNameElement) storeNameElement.textContent = "Carregando...";
    if (storeLogoElement) storeLogoElement.style.display = 'none';

    if (!authInstance.currentUser) return;

    try {
        const establishmentRef = database.collection('establishment')
                                     .where('ownerId', '==', authInstance.currentUser.uid)
                                     .limit(1);
        const snapshot = await establishmentRef.get();
        let storeName = "Minha Loja";
        let logoUrl = "";

        if (!snapshot.empty) {
            const establishmentDoc = snapshot.docs[0].data();
            storeName = establishmentDoc.tradeName || storeName;
            logoUrl = establishmentDoc.logoUrl || establishmentDoc.photoURL || "";
        }
        
        if (storeNameElement) storeNameElement.textContent = storeName;
        if (storeLogoElement) {
            if (logoUrl) {
                storeLogoElement.src = logoUrl;
                storeLogoElement.alt = `Logo de ${storeName}`;
                storeLogoElement.style.display = 'block';
            } else {
                storeLogoElement.style.display = 'none';
            }
        }
    } catch (error) {
        console.error("Erro ao buscar nome/logo da loja:", error);
        if (storeNameElement) storeNameElement.textContent = "Erro ao carregar";
    }
}

function updateUserPlanDisplay(user) {
    const planBadge = document.getElementById('userPlan');
    if (planBadge) planBadge.textContent = "PLANO PREMIUM";
}

function updateLastLoginTime() {
    const lastLoginEl = document.getElementById('lastLoginTime');
    if (lastLoginEl) {
        const now = new Date();
        lastLoginEl.innerHTML = `${now.toLocaleDateString('pt-BR')} <br> (${now.toLocaleTimeString('pt-BR')})`;
    }
}

if (productImageInput) {
    productImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && imagePreview) {
            // Validação de arquivo
            if (!file.type.startsWith('image/')) {
                alert('Por favor, selecione apenas arquivos de imagem.');
                productImageInput.value = '';
                return;
            }

            // Validação de tamanho (máximo 10MB)
            if (file.size > 10 * 1024 * 1024) {
                alert('A imagem deve ter no máximo 10MB.');
                productImageInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        } else if (imagePreview) {
            imagePreview.src = '#';
            imagePreview.style.display = 'none';
        }
    });
}

async function loadAndPopulateCategories(selectedCategoryId = null) {
    const categorySelect = document.getElementById('productCategorySelect');
    if (!categorySelect) {
        console.error("Elemento select de categoria de produto (#productCategorySelect) não encontrado no HTML!");
        return;
    }

    categorySelect.innerHTML = '<option value="">Carregando categorias...</option>';
    categorySelect.disabled = true;

    try {
        const snapshot = await db.collection('categories').orderBy('name').get();
        categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';

        if (snapshot.empty) {
            categorySelect.innerHTML = '<option value="">Nenhuma categoria encontrada</option>';
            categorySelect.disabled = false;
            return;
        }

        snapshot.forEach(doc => {
            const category = { id: doc.id, ...doc.data() };
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            option.dataset.categoryName = category.name;
            if (selectedCategoryId === category.id) {
                option.selected = true;
            }
            categorySelect.appendChild(option);
        });
        categorySelect.disabled = false;
    } catch (error) {
        console.error("Erro ao carregar categorias:", error);
        categorySelect.innerHTML = '<option value="">Erro ao carregar</option>';
        categorySelect.disabled = true;
    }
}

async function openProductModal(product = null) {
    if (productForm) productForm.reset(); // Limpa o formulário, incluindo file input implicitamente
    
    if(imagePreview) {
        imagePreview.style.display = 'none';
        imagePreview.src = '#';
    }
    // O reset do formulário já deve limpar productImageInput.value, mas para garantir:
    if(productImageInput) productImageInput.value = '';

    const categorySelect = document.getElementById('productCategorySelect');
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    } else {
        console.warn("#productCategorySelect não encontrado. As categorias não serão carregadas.");
    }

    if (product) { // Editando produto existente
        if(modalTitle) modalTitle.textContent = 'Editar Produto';
        if(productIdInput) productIdInput.value = product.id;
        if(productNameInput) productNameInput.value = product.name;
        // Se você ainda tiver um campo de descrição no formulário HTML e quiser preenchê-lo:
        const productDescriptionField = document.getElementById('productDescription');
        if(productDescriptionField && product.description) productDescriptionField.value = product.description;

        if(productPriceInput) productPriceInput.value = product.price;
        if(productEanInput && product.ean) productEanInput.value = product.ean; // Preenche EAN
        if(productStockInput) productStockInput.value = product.stock === undefined || product.stock === null ? '' : product.stock;
        
        if (product.image && imagePreview) {
            imagePreview.src = product.image;
            imagePreview.style.display = 'block';
        } else if (imagePreview) {
             imagePreview.src = '#';
             imagePreview.style.display = 'none';
        }
        // Usa product.category_id (snake_case) para carregar categorias
        if (categorySelect) await loadAndPopulateCategories(product.category_id);
    } else { // Adicionando novo produto
        if(modalTitle) modalTitle.textContent = 'Adicionar Novo Produto';
        if(productIdInput) productIdInput.value = '';
        if (imagePreview) {
            imagePreview.src = '#';
            imagePreview.style.display = 'none';
        }
        // Limpa campo EAN para novo produto, caso não seja feito pelo reset()
        if(productEanInput) productEanInput.value = "";
        if (categorySelect) await loadAndPopulateCategories();
    }
    if(productModal) productModal.style.display = 'block';
}

function closeProductModal() {
    if(productModal) productModal.style.display = 'none';
}

const addProductBtn = document.getElementById('addProductBtn');
if (addProductBtn) {
    addProductBtn.addEventListener('click', () => openProductModal());
}

const closeButton = document.querySelector('.close-button');
if (closeButton && productModal) {
    closeButton.addEventListener('click', closeProductModal);
}

window.addEventListener('click', (event) => {
    if (event.target === productModal) {
        closeProductModal();
    }
});

// Função para fazer upload de imagem para o Cloudinary
async function uploadImageToCloudinary(file) {
    if (!file) return null;

    // Validações
    if (!file.type.startsWith('image/')) {
        throw new Error('Arquivo deve ser uma imagem');
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
        throw new Error('Imagem muito grande. Máximo 10MB');
    }

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', CLOUDINARY_CONFIG.folder);
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData,
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Erro no upload da imagem');
        }

        const data = await response.json();
        
        // Retorna a URL segura da imagem
        return data.secure_url;

    } catch (error) {
        console.error('Erro no upload para Cloudinary:', error);
        throw error;
    }
}

// Função para deletar imagem do Cloudinary (opcional)
async function deleteImageFromCloudinary(imageUrl) {
    if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
        return; // Não é uma imagem do Cloudinary
    }

    try {
        // Extrai o public_id da URL
        const publicId = extractPublicIdFromUrl(imageUrl);
        if (!publicId) return;

        const timestamp = Math.round(new Date().getTime() / 1000);
        const stringToSign = `public_id=${publicId}&timestamp=${timestamp}`;
        
        // Nota: Para deletar imagens, você precisará implementar a assinatura no backend
        // por questões de segurança, pois requer a API secret
        console.log('Para deletar a imagem, implemente a funcionalidade no backend:', publicId);
        
    } catch (error) {
        console.error('Erro ao tentar deletar imagem:', error);
    }
}

// Função auxiliar para extrair public_id da URL do Cloudinary
function extractPublicIdFromUrl(url) {
    try {
        const regex = /\/v\d+\/(.+)\.[^.]+$/;
        const match = url.match(regex);
        return match ? match[1] : null;
    } catch (error) {
        return null;
    }
}

// Função para mostrar progresso de upload
function showUploadProgress(show = true) {
    let progressElement = document.getElementById('uploadProgress');
    
    if (show) {
        if (!progressElement) {
            progressElement = document.createElement('div');
            progressElement.id = 'uploadProgress';
            progressElement.innerHTML = `
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                            background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 8px; 
                            z-index: 10000; text-align: center;">
                    <div style="margin-bottom: 10px;">Fazendo upload da imagem...</div>
                    <div style="width: 200px; height: 4px; background: #333; border-radius: 2px; overflow: hidden;">
                        <div style="width: 0%; height: 100%; background: #4CAF50; animation: progress 2s infinite;"></div>
                    </div>
                </div>
                <style>
                    @keyframes progress {
                        0% { width: 0%; }
                        50% { width: 70%; }
                        100% { width: 100%; }
                    }
                </style>
            `;
            document.body.appendChild(progressElement);
        }
    } else {
        if (progressElement) {
            progressElement.remove();
        }
    }
}

if (productForm) {
    productForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!auth.currentUser) {
            alert("Você não está logado. Por favor, faça login para salvar produtos.");
            return;
        }

        const productName = productNameInput ? productNameInput.value : "";
        const productPrice = productPriceInput ? parseFloat(productPriceInput.value) : 0;
        const productEan = productEanInput ? productEanInput.value.trim() : ""; // Pega o EAN
        const productStock = productStockInput ? parseInt(productStockInput.value, 10) : 0;
        const imageFile = productImageInput ? productImageInput.files[0] : null;
        const currentProductId = productIdInput ? productIdInput.value : "";

        const categorySelectElement = document.getElementById('productCategorySelect');
        let categoryIdValue = null; // Renomeado para evitar conflito com nome de campo no objeto
        let categoryNameValue = null; // Renomeado para evitar conflito

        if (categorySelectElement && categorySelectElement.value) {
            const selectedOption = categorySelectElement.options[categorySelectElement.selectedIndex];
            if (selectedOption && selectedOption.value) {
                 categoryIdValue = selectedOption.value;
                 categoryNameValue = selectedOption.dataset.categoryName || selectedOption.textContent;
            }
        }
        
        let imageValue = ""; 
        if (imagePreview && imagePreview.src !== '#' && !imagePreview.src.startsWith('data:')) {
            imageValue = imagePreview.src;
        }

        try {
            // Upload da imagem se um arquivo foi selecionado
            if (imageFile) {
                showUploadProgress(true);
                try {
                    const uploadedUrl = await uploadImageToCloudinary(imageFile);
                    imageValue = uploadedUrl || ""; 
                    showUploadProgress(false);
                } catch (uploadError) {
                    showUploadProgress(false);
                    alert('Erro ao fazer upload da imagem: ' + uploadError.message);
                    return; // Para a execução se o upload falhar
                }
            }

            const productData = {
                name: productName,
                price: productPrice,
                // Utiliza snake_case para os campos de categoria, conforme estrutura
                category_id: categoryIdValue, 
                category_name: categoryNameValue,
                ean: productEan, // Adicionado campo ean
                stock: isNaN(productStock) ? null : productStock,
                image: imageValue, // Campo 'image' com string vazia como padrão
                ownerId: auth.currentUser.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                // O campo 'description' foi removido do objeto salvo
            };

            if (currentProductId) {
                // Se está editando e havia uma imagem anterior diferente da nova
                const currentDoc = await db.collection('products').doc(currentProductId).get();
                const currentData = currentDoc.data();
                
                // Se mudou a imagem, pode opcionalmente deletar a anterior
                if (currentData?.image && currentData.image !== imageValue && imageFile) {
                    // deleteImageFromCloudinary(currentData.image); // Descomente se quiser deletar a imagem anterior
                }
                
                await db.collection('products').doc(currentProductId).update(productData);
                alert('Produto atualizado com sucesso!');
            } else {
                productData.createdAt = firebase.firestore.FieldValue.serverTimestamp(); // Adiciona createdAt para novos produtos
                await db.collection('products').add(productData);
                alert('Produto adicionado com sucesso!');
            }
            closeProductModal();
            if (auth.currentUser) {
                loadProducts(auth.currentUser.uid);
            }
        } catch (error) {
            showUploadProgress(false);
            console.error('Erro ao salvar produto:', error);
            alert('Erro ao salvar produto: ' + error.message);
        }
    });
}

async function loadProducts(userId) {
    const productListDiv = document.getElementById('productList');
    if (!productListDiv) {
        console.warn("Elemento #productList não encontrado para carregar produtos.");
        return;
    }
    productListDiv.innerHTML = '<p>Carregando produtos...</p>';

    try {
        const snapshot = await db.collection('products')
                                 .where('ownerId', '==', userId)
                                 .orderBy('name', 'asc')
                                 .get();
        
        if (snapshot.empty) {
            productListDiv.innerHTML = '<p>Nenhum produto cadastrado ainda. Clique em "Adicionar Produto" para começar.</p>';
            return;
        }

        productListDiv.innerHTML = '';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = document.createElement('div');
            card.className = 'product-card';
            
            // Se o campo description existir no produto, você pode exibi-lo.
            // Caso contrário, ele será ignorado se product.description for undefined.
            const descriptionHTML = product.description ? `<p class="product-description">${product.description}</p>` : '';

            // Otimiza a exibição da imagem com lazy loading e fallback
            let imageHTML = '';
            if (product.image) {
                imageHTML = `<img src="${product.image}" alt="${product.name}" class="product-image-thumbnail" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div style="height:150px; background:#f0f0f0; display:none; align-items:center; justify-content:center; color:#ccc; border-radius:4px; margin-bottom:10px;">Erro ao carregar</div>`;
            } else {
                imageHTML = '<div style="height:150px; background:#f0f0f0; display:flex; align-items:center; justify-content:center; color:#ccc; border-radius:4px; margin-bottom:10px;">Sem Imagem</div>';
            }

            card.innerHTML = `
                ${imageHTML}
                <h4>${product.name}</h4>
                ${descriptionHTML} 
                <p class="product-price">R$ ${typeof product.price === 'number' ? product.price.toFixed(2).replace('.', ',') : 'N/A'}</p>
                ${product.category_name ? `<p class="product-category">Categoria: ${product.category_name}</p>` : ''} 
                ${product.ean ? `<p class="product-ean" style="font-size:0.8em; color:#777;">EAN: ${product.ean}</p>` : ''}
                ${product.stock !== null && product.stock !== undefined ? `<p class="product-stock">Estoque: ${product.stock} unidades</p>` : '<p class="product-stock">Estoque não informado</p>'}
                <div class="product-actions">
                    <button class="btn btn-edit" data-id="${product.id}">Editar</button>
                    <button class="btn btn-delete" data-id="${product.id}">Excluir</button>
                </div>
            `;
            productListDiv.appendChild(card);
        });

        document.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                try {
                    const docSnap = await db.collection('products').doc(id).get();
                    if (docSnap.exists) { 
                        openProductModal({ id: docSnap.id, ...docSnap.data() });
                    } else {
                        console.warn("Tentativa de editar produto não encontrado, ID:", id);
                        alert("Produto não encontrado. Pode ter sido excluído recentemente.");
                    }
                } catch (error) {
                    console.error("Erro ao buscar produto para edição:", error);
                    alert("Erro ao carregar dados do produto para edição.");
                }
            });
        });

        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                if (confirm('Tem certeza que deseja excluir este produto?')) {
                    try {
                        // Opcionalmente, deletar a imagem do Cloudinary antes de deletar o produto
                        const docSnap = await db.collection('products').doc(id).get();
                        if (docSnap.exists) {
                            const productData = docSnap.data();
                            // if (productData.image) {
                            //     deleteImageFromCloudinary(productData.image);
                            // }
                        }

                        await db.collection('products').doc(id).delete();
                        alert('Produto excluído com sucesso!');
                        if (auth.currentUser) {
                           loadProducts(auth.currentUser.uid);
                        }
                    } catch (error) {
                        console.error('Erro ao excluir produto:', error);
                        alert('Erro ao excluir produto.');
                    }
                }
            });
        });

    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        productListDiv.innerHTML = '<p>Erro ao carregar produtos. Verifique o console para mais detalhes.</p>';
    }
}

window.addEventListener('load', () => {
    const elements = document.querySelectorAll('.page-header, .product-list-container');
    elements.forEach((el, index) => {
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            setTimeout(() => {
                el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 150);
        }
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('PWA: Service Worker registrado com sucesso!', registration))
            .catch(error => console.error('PWA: Falha ao registrar Service Worker:', error));
    }
});