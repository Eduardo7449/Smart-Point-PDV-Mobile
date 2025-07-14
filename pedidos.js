const firebaseConfig = {
  apiKey: "AIzaSyAg0DdzFPBnGyEe_aLhVIwU5Ksljd0jTkY",
  authDomain: "smart-point-pdv-ed911.firebaseapp.com",
  databaseURL: "https://smart-point-pdv-ed911-default-rtdb.firebaseio.com",
  projectId: "smart-point-pdv-ed911",
  storageBucket: "smart-point-pdv-ed911.appspot.com",
  messagingSenderId: "308482043681",
  appId: "1:308482043681:web:0505c90795b9151e7b9860"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- LOG DE DIAGNÓSTICO ---
console.log("Script 'pedidos.js' carregado. Aguardando autenticação...");

// Elementos da UI
const loadingIndicator = document.getElementById('loadingIndicator');
const ordersListContainer = document.getElementById('ordersList');
const noOrdersMessage = document.getElementById('noOrdersMessage');
const refreshBtn = document.getElementById('refreshBtn');

// Elementos do Modal de Detalhes
const detailsModal = document.getElementById('orderDetailsModal');
const detailsModalCloseBtn = detailsModal.querySelector('.close-btn');
const modalOrderInfo = document.getElementById('modalOrderInfo');
const modalItemsTableBody = document.querySelector('#modalItemsTable tbody');
const finalizeOrderBtn = document.getElementById('finalizeOrderBtn');

// Elementos do Modal de Alerta/Confirmação
const alertModal = document.getElementById('customAlertModal');
const alertTitle = document.getElementById('customAlertTitle');
const alertMessage = document.getElementById('customAlertMessage');
const alertButtons = document.getElementById('customAlertButtons');

// ===== NOVOS ELEMENTOS DO MODAL DE PAGAMENTO =====
const paymentModal = document.getElementById('paymentModal');
const paymentModalCloseBtn = document.getElementById('paymentModalCloseBtn');
const paymentModalTotal = document.getElementById('paymentModalTotal');
const paymentConfirmBtn = document.getElementById('paymentConfirmBtn');
const paymentCancelBtn = document.getElementById('paymentCancelBtn');
const paymentOptionsContainer = document.getElementById('paymentOptions');


let currentUser = null;
let currentOrderData = null;
let ordersListener = null;

// --- Funções do Modal Genérico (sem alterações) ---
function showAlert(title, message, onOk) {
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    alertButtons.innerHTML = `<button id="alertOkBtn" class="btn btn-primary">OK</button>`;
    alertModal.classList.add('visible');
    
    document.getElementById('alertOkBtn').onclick = () => {
        alertModal.classList.remove('visible');
        if (onOk) onOk();
    };
}

// --- LÓGICA PRINCIPAL (sem alterações) ---
function setupOrdersListener() {
    if (!currentUser) {
        console.warn("setupOrdersListener chamado, mas nenhum usuário está logado.");
        return;
    }
    
    if (ordersListener) {
        ordersListener(); 
    }

    console.log(`Configurando listener de pedidos para o usuário: ${currentUser.uid}`);
    loadingIndicator.style.display = 'block';
    noOrdersMessage.style.display = 'none';

    const query = db.collection('orders')
        .where('ownerId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc');

    ordersListener = query.onSnapshot(snapshot => {
        loadingIndicator.style.display = 'none';
        
        console.log(`Snapshot recebido! A consulta por 'ownerId' e 'createdAt' retornou ${snapshot.size} documento(s) para este usuário.`);

        if (snapshot.empty) {
            console.log("Nenhum documento 'order' encontrado para este 'ownerId' no Firestore que contenha o campo 'createdAt'.");
        }
        
        ordersListContainer.innerHTML = '';
        const pendingOrders = [];

        snapshot.forEach(doc => {
            const orderData = doc.data();
            const order = { id: doc.id, ...orderData };
            
            if (order.status !== 'completed') {
                pendingOrders.push(order);
            }
        });

        console.log(`Encontrados ${pendingOrders.length} pedidos pendentes após o filtro local.`);

        if (pendingOrders.length === 0) {
            noOrdersMessage.style.display = 'block';
        } else {
            noOrdersMessage.style.display = 'none';
            pendingOrders.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
            pendingOrders.forEach(order => renderOrderCard(order));
        }

    }, error => {
        loadingIndicator.style.display = 'none';
        console.error("ERRO GRAVE no listener do Firestore:", error);
        showAlert(
            "Erro de Banco de Dados", 
            `Não foi possível carregar os pedidos. Verifique o console (F12) para um erro detalhado. A causa mais provável é a falta de um índice no Firestore.`
        );
    });
}

// --- Funções de renderização e modais (sem alterações) ---
function renderOrderCard(order) {
    const card = document.createElement('div');
    const status = order.status || 'Pendente';
    card.className = `order-card status-${status} transform hover:scale-105 transition-transform duration-200`;
    card.dataset.id = order.id;

    const deliveryType = order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada';
    const total = parseFloat(order.total || 0).toFixed(2).replace('.', ',');
    
    card.innerHTML = `
        <div class="flex justify-between items-start">
            <span class="font-bold text-lg">${order.customerName || 'Cliente não informado'}</span>
            <span class="font-semibold text-gray-800">R$ ${total}</span>
        </div>
        <div class="mt-2 text-sm text-gray-600">
            <p>Status: <strong class="font-semibold text-gray-900">${status}</strong></p>
            <p>Tipo: <strong class="font-semibold text-gray-900">${deliveryType}</strong></p>
        </div>
    `;

    card.addEventListener('click', () => showOrderDetails(order));
    ordersListContainer.appendChild(card);
}

function showOrderDetails(order) {
    currentOrderData = order; 

    const deliveryType = order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada';
    const paymentMethodMap = { "cash": "Dinheiro", "card": "Cartão", "pix": "Pix" };
    const paymentMethod = paymentMethodMap[order.paymentMethod] || "Não definido";
    const total = parseFloat(order.total || 0).toFixed(2).replace('.', ',');

    modalOrderInfo.innerHTML = `
        <p><strong>Cliente:</strong> ${order.customerName || 'N/A'}</p>
        <p><strong>Tipo:</strong> ${deliveryType}</p>
        <p><strong>Endereço:</strong> ${order.address || 'N/A'}</p>
        <p><strong>Pagamento:</strong> ${paymentMethod}</p>
        <p><strong>Status:</strong> ${order.status || 'Pendente'}</p>
        <p class="text-lg font-bold"><strong>Total:</strong> R$ ${total}</p>
    `;

    modalItemsTableBody.innerHTML = '';
    let items = order.items || [];
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = []; }
    }

    if (Array.isArray(items)) {
        items.forEach(item => {
            const row = modalItemsTableBody.insertRow();
            const subtotal = parseFloat(item.subtotal || item.price * item.quantity).toFixed(2);
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">${item.name || item.productName || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">${item.quantity || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap">R$ ${subtotal.replace('.',',')}</td>
            `;
        });
    }

    detailsModal.classList.add('visible');
}

// ===== LÓGICA DE FINALIZAÇÃO ATUALIZADA =====

/**
 * Abre o modal de pagamento para o pedido atual.
 */
function showPaymentModal() {
    if (!currentOrderData) return;

    // Popula o total no modal de pagamento
    const total = parseFloat(currentOrderData.total || 0).toFixed(2).replace('.', ',');
    paymentModalTotal.textContent = `R$ ${total}`;

    // Desmarca qualquer opção de pagamento anterior
    const checkedRadio = paymentOptionsContainer.querySelector('input[name="paymentMethod"]:checked');
    if (checkedRadio) {
        checkedRadio.checked = false;
    }

    // Exibe o modal
    paymentModal.classList.add('visible');
}

/**
 * Processa a venda, salva no Firestore e atualiza o pedido.
 * Esta função replica a lógica de 'finalize_order' do orders.py.
 */
async function processAndSaveSale() {
    if (!currentOrderData || !currentUser) return;

    const selectedPaymentMethod = paymentOptionsContainer.querySelector('input[name="paymentMethod"]:checked');
    if (!selectedPaymentMethod) {
        showAlert("Atenção", "Por favor, selecione uma forma de pagamento.");
        return;
    }

    paymentConfirmBtn.disabled = true;
    paymentConfirmBtn.textContent = 'Processando...';

    // Referência para o documento do contador que você criou no Passo 1
    const counterRef = db.collection('counters').doc('salesCounter');
    
    try {
        // Executa tudo dentro de uma transação para garantir a atomicidade
        await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            if (!counterDoc.exists) {
                // Se o documento não existir, lança um erro.
                // Isso evita que a aplicação continue se o Passo 1 não foi feito.
                throw new Error("Documento de contador 'salesCounter' não encontrado!");
            }

            // Pega o último número e incrementa
            const lastNumber = counterDoc.data().lastNumber || 0;
            const newSaleNumber = lastNumber + 1;

            // Formata a data como solicitado
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

            // Prepara os dados da venda
            const saleData = {
                saleNumber: newSaleNumber, // <-- USO DO NOVO NÚMERO SEQUENCIAL
                date: formattedDate,
                total: parseFloat(currentOrderData.total || 0),
                userId: currentUser.uid,
                paymentMethod: selectedPaymentMethod.value,
                items: (currentOrderData.items || []).map(item => ({
                    name: item.name || item.productName || 'N/A',
                    quantity: item.quantity || 0,
                    price: parseFloat(item.price || 0),
                    subtotal: parseFloat(item.subtotal || (item.price * item.quantity)),
                    productId: item.productId || ""
                })),
                vendor: "N/A",
                vendorId: "",
                orderId: currentOrderData.id,
                customerName: currentOrderData.customerName || "N/A"
            };

            // Dentro da transação, realiza todas as escritas no banco:
            // 1. Cria o novo documento de venda
            const newSaleRef = db.collection('sales').doc(); // Cria uma referência com ID automático
            transaction.set(newSaleRef, saleData);

            // 2. Atualiza o contador com o novo último número
            transaction.update(counterRef, { lastNumber: newSaleNumber });

            // 3. Atualiza o status do pedido original
            const orderRef = db.collection('orders').doc(currentOrderData.id);
            transaction.update(orderRef, { status: 'completed' });
        });

        // Se a transação for concluída com sucesso:
        console.log("Transação concluída com sucesso!");
        closePaymentModal();
        closeDetailsModal();
        showAlert("Sucesso!", "Venda finalizada e salva com sucesso!");

    } catch (error) {
        // Se a transação falhar:
        console.error("Erro ao finalizar a venda (transação falhou):", error);
        showAlert("Erro", `Falha ao processar a venda: ${error.message}`);
    } finally {
        // Restaura o botão de confirmação independentemente do resultado
        paymentConfirmBtn.disabled = false;
        paymentConfirmBtn.textContent = 'Confirmar Venda';
    }
}


function closeDetailsModal() {
    detailsModal.classList.remove('visible');
    currentOrderData = null;
}

function closePaymentModal() {
    paymentModal.classList.remove('visible');
}

// ===== OUVINTES DE EVENTOS (EVENT LISTENERS) ATUALIZADOS =====
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log(`onAuthStateChanged: Usuário detectado! UID: ${user.uid}. Iniciando o listener de pedidos...`);
            currentUser = user;
            setupOrdersListener();
        } else {
            console.log("onAuthStateChanged: Nenhum usuário logado. Redirecionando para /login.html");
            if(ordersListener) {
                ordersListener();
            }
            currentUser = null;
            window.location.href = '/login.html';
        }
    });

    refreshBtn.addEventListener('click', () => {
        console.log("Botão de atualizar clicado. Reiniciando o listener.");
        setupOrdersListener();
    });
    
    // Listeners do Modal de Detalhes
    detailsModalCloseBtn.addEventListener('click', closeDetailsModal);
    finalizeOrderBtn.addEventListener('click', showPaymentModal); // <--- MUDANÇA AQUI
    detailsModal.addEventListener('click', (event) => {
        if (event.target === detailsModal) closeDetailsModal();
    });

    // Listeners do Modal de Alerta
    alertModal.addEventListener('click', (event) => {
        if (event.target === alertModal) alertModal.classList.remove('visible');
    });

    // ===== NOVOS LISTENERS PARA O MODAL DE PAGAMENTO =====
    paymentModalCloseBtn.addEventListener('click', closePaymentModal);
    paymentCancelBtn.addEventListener('click', closePaymentModal);
    paymentConfirmBtn.addEventListener('click', processAndSaveSale);
    paymentModal.addEventListener('click', (event) => {
        if (event.target === paymentModal) closePaymentModal();
    });
});

document.addEventListener('touchmove', function (event) {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });