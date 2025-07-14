document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyAg0DdzFPBnGyEe_aLhVIwU5Ksljd0jTkY", // SUA CHAVE DE API
        authDomain: "smart-point-pdv-ed911.firebaseapp.com",
        projectId: "smart-point-pdv-ed911",
        storageBucket: "smart-point-pdv-ed911.appspot.com",
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const storage = firebase.storage();
    const auth = firebase.auth();

    // --- VARIÁVEIS DE ESTADO ---
    let cart = [];
    let allProducts = [];
    let allCustomers = [];
    let allVendors = [];
    let selectedCustomerId = null;
    let selectedVendorId = null;
    let saleCounter = 1;
    let codeReaderControls = null;
    let isScanning = false;
    let selectedPaymentMethod = 'Dinheiro';
    let currentUser = null;

    // --- ELEMENTOS DO DOM ---
    const productGrid = document.getElementById('product-grid');
    const productSearchInput = document.getElementById('product-search-input');
    const checkoutButton = document.getElementById('checkout-button');
    const checkoutText = document.getElementById('checkout-text');
    const checkoutTotal = document.getElementById('checkout-total');
    
    const productView = document.getElementById('product-view');
    const cartView = document.getElementById('cart-view');
    const cartItemsList = document.getElementById('cart-items-list');
    
    const summarySubtotal = document.getElementById('summary-subtotal');
    const summaryTotal = document.getElementById('summary-total');

    // Modals
    const customerModal = document.getElementById('customer-modal');
    const vendorModal = document.getElementById('vendor-modal');
    const signatureModal = document.getElementById('signature-modal');
    const customerList = document.getElementById('customer-list');
    const vendorList = document.getElementById('vendor-list');

    const scanButton = document.getElementById('scan-button');
    const scannerModal = document.getElementById('scanner-modal');
    const videoElement = document.getElementById('video-scanner');
    const cancelScanBtn = document.getElementById('cancel-scan-btn');

    // --- AUTENTICAÇÃO ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            initializePDV();
        } else {
            // Se não houver usuário, redirecionar para o login
            window.location.href = '/login.html'; 
        }
    });

    // --- INICIALIZAÇÃO ---
    async function initializePDV() {
        await loadProducts();
        await loadCustomers();
        await loadVendors();
        setupEventListeners();
    }

    // --- CARREGAMENTO DE DADOS (FIREBASE) ---
    async function loadProducts() {
        const snapshot = await db.collection('products').where('ownerId', '==', currentUser.uid).get();
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayProducts(allProducts);
    }

    async function loadCustomers() {
        const snapshot = await db.collection('customers').where('ownerId', '==', currentUser.uid).get();
        allCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Adiciona um cliente padrão
        allCustomers.unshift({ id: 'default', name: 'Consumidor Padrão' });
        populateSelectionList(customerList, allCustomers, 'customer');
    }

    async function loadVendors() {
        const snapshot = await db.collection('vendors').where('ownerId', '==', currentUser.uid).get();
        allVendors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateSelectionList(vendorList, allVendors, 'vendor');
    }

    // --- RENDERIZAÇÃO NA TELA ---
    function displayProducts(productsToDisplay) {
    productGrid.innerHTML = '';
    if (productsToDisplay.length === 0) {
        productGrid.innerHTML = '<p>Nenhum produto encontrado.</p>';
        return;
    }
    productsToDisplay.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.productId = product.id;
        
        const imageUrl = product.image || 'https://via.placeholder.com/80?text=Sem+Imagem';

        card.innerHTML = `
            <img src="${imageUrl}" alt="${product.name}">
            <div class="product-name">${product.name}</div>
            <div class="product-price">R$ ${product.price.toFixed(2).replace('.', ',')}</div>
        `;
        card.addEventListener('click', () => addToCart(product.id));
        productGrid.appendChild(card);
    });
}

    function populateSelectionList(listElement, items, type) {
        listElement.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.name;
            li.dataset.id = item.id;
            li.addEventListener('click', () => {
                if (type === 'customer') {
                    selectCustomer(item.id, item.name);
                } else {
                    selectVendor(item.id, item.name);
                }
            });
            listElement.appendChild(li);
        });
    }

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++;
        existingItem.subtotal = existingItem.price * existingItem.quantity;
    } else {
        // CORREÇÃO: Adicionamos o imageUrl de volta ao objeto do carrinho para exibição.
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            productId: product.id,
            quantity: 1,
            subtotal: product.price,
            imageUrl: product.image || null // Adicionamos a URL da imagem aqui
        });
    }
    updateCart();
}
    
    function updateCart() {
        renderCartItems();
        updateCheckoutButton();
        updateSummary();
    }
    
    function renderCartItems() {
    cartItemsList.innerHTML = '';
    cart.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'cart-item';

        // CORREÇÃO: Usamos item.imageUrl para exibir a imagem correta.
        const imageUrl = item.imageUrl || 'https://via.placeholder.com/50?text=Sem+Img';

        li.innerHTML = `
            <img src="${imageUrl}" alt="${item.name}">
            <div class="cart-item-info">
                <div class="name">${item.name}</div>
                <div>R$ ${item.price.toFixed(2).replace('.', ',')}</div>
            </div>
            <div class="cart-item-controls">
                <button class="decrease-qty" data-index="${index}">-</button>
                <span>${item.quantity}</span>
                <button class="increase-qty" data-index="${index}">+</button>
            </div>
        `;
        cartItemsList.appendChild(li);
    });
}

    function changeQuantity(index, amount) {
    if (!cart[index]) return;

    cart[index].quantity += amount;
    // Recalcula o subtotal do item
    cart[index].subtotal = cart[index].price * cart[index].quantity;

    if (cart[index].quantity <= 0) {
        cart.splice(index, 1); // Remove o item se a quantidade for 0 ou menor
    }
    updateCart();
}
    
    function calculateTotal() {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }
    
    function updateCheckoutButton() {
        const total = calculateTotal();
        if (cart.length > 0) {
            checkoutButton.disabled = false;
            checkoutText.textContent = `${cart.length} item(s)`;
            checkoutTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        } else {
            checkoutButton.disabled = true;
            checkoutText.textContent = 'Cobrar';
            checkoutTotal.textContent = 'R$ 0,00';
        }
    }

    function updateSummary() {
        const total = calculateTotal();
        summarySubtotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        summaryTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }

    // --- CONTROLE DE FLUXO E EVENTOS ---
    function setupEventListeners() {
    // Listener para a barra de pesquisa de produtos
    // Filtra os produtos exibidos conforme o usuário digita.
    productSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
        displayProducts(filteredProducts);
    });

    // Listener para o botão principal de checkout / finalizar compra
    // Controla a transição para a tela do carrinho e a finalização da venda.
    checkoutButton.addEventListener('click', handleCheckout);

    // Listener para os botões de + e - nos itens do carrinho
    // Usa "delegação de evento" para gerenciar todos os botões com um único listener.
    cartItemsList.addEventListener('click', (e) => {
        const index = e.target.dataset.index;
        if (e.target.classList.contains('increase-qty')) {
            changeQuantity(index, 1);
        }
        if (e.target.classList.contains('decrease-qty')) {
            changeQuantity(index, -1);
        }
    });

    // Listeners para abrir os modais de seleção
    document.getElementById('customer-selector-btn').addEventListener('click', () => customerModal.style.display = 'flex');
    document.getElementById('vendor-selector-btn').addEventListener('click', () => vendorModal.style.display = 'flex');

    // Listener para fechar qualquer modal pelo botão '×'
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById(e.target.dataset.modal).style.display = 'none';
        });
    });

    // Listeners para o scanner de código de barras
    scanButton.addEventListener('click', startScanner);
    cancelScanBtn.addEventListener('click', stopScanner);

    // Listener para os botões de forma de pagamento
    // Usa "delegação de evento" para gerenciar a seleção do método de pagamento.
    const paymentContainer = document.getElementById('payment-method-buttons');
    if (paymentContainer) {
        paymentContainer.addEventListener('click', (e) => {
            const clickedButton = e.target.closest('.payment-btn');
            if (!clickedButton) return; // Sai se o clique não foi em um botão

            // Armazena o valor do botão clicado
            selectedPaymentMethod = clickedButton.dataset.value;

            // Atualiza a aparência dos botões para destacar o ativo
            paymentContainer.querySelectorAll('.payment-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            clickedButton.classList.add('active');
        });
    }
}

    function selectCustomer(id, name) {
        selectedCustomerId = id;
        document.getElementById('customer-name').textContent = name.split(' ')[0]; // Mostra só o primeiro nome
        customerModal.style.display = 'none';
    }

    function selectVendor(id, name) {
        selectedVendorId = id;
        selectedVendorName = name;
        document.getElementById('vendor-name').textContent = name.split(' ')[0];
        vendorModal.style.display = 'none';
    }
    
    async function handleCheckout() {
        const currentText = checkoutButton.querySelector('#checkout-text').textContent;

        if (currentText === 'Finalizar Compra') {
            // Lógica de finalização da venda
            const paymentMethod = selectedPaymentMethod;

            if (paymentMethod === 'Fiado' && (!selectedCustomerId || selectedCustomerId === 'default')) {
                alert('Para vendas em "Fiado", por favor, selecione um cliente cadastrado.');
                return;
            }

            let signatureUrl = null;
            if (paymentMethod === 'Fiado') {
                signatureUrl = await getSignatureFromModal();
                if (!signatureUrl) {
                    alert('Assinatura é obrigatória para vendas em Fiado. Venda cancelada.');
                    return;
                }
            }

            // Salvar no banco de dados
            saveSale(paymentMethod, signatureUrl);

        } else {
            // Mudar para a tela de carrinho
            productView.classList.add('hidden');
            cartView.classList.remove('hidden');
            checkoutText.textContent = 'Finalizar Compra';
        }
    }

    async function saveSale(paymentMethod, signatureUrl) {
    if (!currentUser) {
        alert("Erro: Usuário não está logado.");
        return;
    }

    // Monta o objeto final com a estrutura exata
    const saleData = {
        date: getFormattedDateTime(), // 1. Usa a data formatada como string
        items: cart,                  // 2. Os itens já estão na estrutura correta
        paymentMethod: paymentMethod,
        saleNumber: String(saleCounter), // 3. Adiciona o número da venda como string
        total: calculateTotal(),
        userId: currentUser.uid,
        vendor: selectedVendorName || "Não Informado", // 4. Adiciona o nome do vendedor
        vendorId: selectedVendorId || null
    };
    
    // A lógica para cliente e fiado continua opcional
    if (selectedCustomerId && selectedCustomerId !== 'default') {
        saleData.customerId = selectedCustomerId;
    }
    if (signatureUrl) {
        saleData.signatureUrl = signatureUrl;
    }

    try {
        const saleRef = await db.collection('sales').add(saleData);

        if (paymentMethod === 'Fiado' && saleData.customerId) {
            await db.collection('debts').add({
                userId: currentUser.uid,
                customerId: saleData.customerId,
                saleId: saleRef.id,
                amount: saleData.total,
                date: saleData.date, // Usa a mesma string de data
                status: 'unpaid'
            });
        }
        
        alert('Venda finalizada com sucesso!');
        saleCounter++; // Incrementa o contador para a próxima venda
        resetPDV();

    } catch (error) {
        console.error("Erro ao salvar a venda: ", error);
        alert("Ocorreu um erro ao finalizar a venda.");
    }
}

    function resetPDV() {
        cart = [];
        selectedCustomerId = null;
        selectedVendorId = null;

        document.getElementById('customer-name').textContent = 'Cliente';
        document.getElementById('vendor-name').textContent = 'Vendedor';

        productView.classList.remove('hidden');
        cartView.classList.add('hidden');

        updateCart();
    }
    
    // --- LÓGICA DA ASSINATURA DIGITAL ---
    const canvas = document.getElementById('signature-canvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;

    function getSignatureFromModal() {
        return new Promise(resolve => {
            signatureModal.style.display = 'flex';
            
            // Redimensionar canvas para o tamanho real
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;

            function startDrawing(e) {
                drawing = true;
                draw(e);
            }
            function stopDrawing() {
                drawing = false;
                ctx.beginPath();
            }
            function draw(e) {
                if (!drawing) return;
                e.preventDefault(); // Previne scroll
                const pos = getMousePos(canvas, e);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
            }
             function getMousePos(canvasDom, mouseEvent) {
                const rect = canvasDom.getBoundingClientRect();
                const event = mouseEvent.touches ? mouseEvent.touches[0] : mouseEvent;
                return {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top
                };
            }

            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('touchstart', startDrawing);
            canvas.addEventListener('touchend', stopDrawing);
            canvas.addEventListener('touchmove', draw);


            document.getElementById('clear-signature-btn').onclick = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            };

            document.getElementById('save-signature-btn').onclick = () => {
                canvas.toBlob(async (blob) => {
                    if (blob.size < 100) { // Se a assinatura estiver vazia
                        resolve(null);
                    } else {
                        const filePath = `signatures/${currentUser.uid}/${new Date().toISOString()}.png`;
                        const fileRef = storage.ref(filePath);
                        await fileRef.put(blob);
                        const url = await fileRef.getDownloadURL();
                        resolve(url);
                    }
                    signatureModal.style.display = 'none';
                });
            };
        });
    }

    function findProductByEan(ean) {
    // Remove os dígitos de verificação se houver (comum em EAN-13)
    const cleanEan = ean.length > 12 ? ean.substring(0, 12) : ean;
    
    // Procura pelo EAN exato ou pela versão limpa
    return allProducts.find(p => p.ean === ean || p.ean === cleanEan);
}


// Função para INICIAR o scanner
async function startScanner() {
    isScanning = true; // 1. Levantamos a bandeira, indicando que o escaneamento começou
    const codeReader = new ZXing.BrowserMultiFormatReader();
    scannerModal.style.display = 'flex';

    try {
        codeReaderControls = await codeReader.decodeFromVideoDevice(undefined, 'video-scanner', (result, err, controls) => {
            // 2. A mágica acontece aqui: só processamos se a bandeira estiver levantada
            if (result && isScanning) {
                isScanning = false; // 3. Imediatamente abaixamos a bandeira para ignorar os próximos scans

                // O resto do código continua como antes
                stopScanner();
                handleScannedCode(result.getText());
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error('Erro no scanner:', err);
            }
        });
    } catch (error) {
        console.error('Erro ao acessar a câmera:', error);
        alert('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        stopScanner();
    }
}

// Função para PARAR o scanner
function stopScanner() {
    isScanning = false; // Garante que a flag seja resetada ao cancelar
    if (codeReaderControls) {
        codeReaderControls.stop();
        codeReaderControls = null;
    }
    scannerModal.style.display = 'none';
}

// Função para lidar com o código escaneado
function handleScannedCode(ean) {
    const product = findProductByEan(ean);

    if (product) {
        addToCart(product.id);
        // Feedback para o usuário (opcional, mas recomendado)
        if (navigator.vibrate) {
            navigator.vibrate(100); // Vibra por 100ms
        }
        alert(`Produto "${product.name}" adicionado ao carrinho!`);
    } else {
        alert(`Produto com código EAN "${ean}" não encontrado.`);
    }
}

        document.addEventListener('touchmove', function (event) {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
        }, { passive: false });

});

function getFormattedDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}