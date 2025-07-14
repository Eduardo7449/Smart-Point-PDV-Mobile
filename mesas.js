// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAg0DdzFPBnGyEe_aLhVIwU5Ksljd0jTkY",
  authDomain: "smart-point-pdv-ed911.firebaseapp.com",
  databaseURL: "https://smart-point-pdv-ed911-default-rtdb.firebaseio.com",
  projectId: "smart-point-pdv-ed911",
  storageBucket: "smart-point-pdv-ed911.appspot.com",
  messagingSenderId: "308482043681",
  appId: "1:308482043681:web:0505c90795b9151e7b9860"
};

// Inicialização
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Variáveis Globais de Estado
let currentUser = null;
let selectedTable = null;
let allProducts = [];
let paymentData = {
    items: [],
    total: 0,
    type: 'full', // 'full' or 'partial'
    paymentMethod: null
};
let splitBillData = {
    unpaid: [],
    paying: []
};

// --- Seletores de Elementos da UI ---
const getEl = (id) => document.getElementById(id);
// Painel Principal
const tableNameEntry = getEl('tableNameEntry');
const submitTableBtn = getEl('submitTableBtn');
const statusLabel = getEl('statusLabel');
const freeTablesList = getEl('freeTablesList');
const busyTablesList = getEl('busyTablesList');
// Painel de Detalhes
const tableDetailsPanel = getEl('tableDetailsPanel');
const tableInfoLabel = getEl('tableInfoLabel');
const orderTree = getEl('orderTree');
const totalLabel = getEl('totalLabel');
// Modal de Produto
const addProductModal = getEl('addProductModal');
const productSearchEntry = getEl('productSearchEntry');
const productTree = getEl('productTree');
const quantityEntry = getEl('quantityEntry');
// Modal de Divisão de Conta
const splitBillModal = getEl('splitBillModal');
const splitBillTitle = getEl('splitBillTitle');
const unpaidItemsList = getEl('unpaidItemsList');
const payingItemsList = getEl('payingItemsList');
const splitTotalLabel = getEl('splitTotalLabel');
// Modal de Pagamento
const paymentModal = getEl('paymentModal');
const paymentTotal = getEl('paymentTotal');
const paymentMethodSelector = getEl('paymentMethodSelector');
const cashPaymentFields = getEl('cashPaymentFields');
const amountPaidInput = getEl('amountPaidInput');
const changeDisplay = getEl('changeDisplay');
const confirmPaymentBtn = getEl('confirmPaymentBtn');


// --- INICIALIZAÇÃO E EVENT LISTENERS GERAIS ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loadTables();
        preloadProducts();
    } else {
        window.location.href = '/login.html';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Ações da Mesa
    submitTableBtn.addEventListener('click', submitTable);
    getEl('addProductBtn').addEventListener('click', showProductModal);
    getEl('deleteTableBtn').addEventListener('click', deleteTable);
    orderTree.addEventListener('click', handleOrderClick);

    // Finalização e Divisão
    getEl('finalizeSaleBtn').addEventListener('click', handleFinalizeSale);
    getEl('splitBillBtn').addEventListener('click', showSplitBillModal);

    // Modal de Produto
    productSearchEntry.addEventListener('keyup', searchProducts);

    // Listeners Modal Divisão de Conta
    unpaidItemsList.addEventListener('click', e => moveItemToPaying(e.target.closest('li')?.dataset.uuid));
    payingItemsList.addEventListener('click', e => moveItemToUnpaid(e.target.closest('li')?.dataset.uuid));
    getEl('closeSplitBillBtn').addEventListener('click', () => splitBillModal.style.display = 'none');
    getEl('cancelSplitBillBtn').addEventListener('click', () => splitBillModal.style.display = 'none');
    getEl('paySplitBtn').addEventListener('click', handlePaySplit);

    // Listeners Modal de Pagamento
    paymentMethodSelector.addEventListener('click', selectPaymentMethod);
    amountPaidInput.addEventListener('input', calculateChange);
    getEl('closePaymentModalBtn').addEventListener('click', () => paymentModal.style.display = 'none');
    getEl('cancelPaymentBtn').addEventListener('click', () => paymentModal.style.display = 'none');
    confirmPaymentBtn.addEventListener('click', processPayment);
});


// --- LÓGICA PRINCIPAL DE MESAS ---
// (Funções loadTables, createTableCard, submitTable, openTable, closeDetailsPanel, updateDetailsPanel não mudaram significativamente e foram omitidas por brevidade)
// ... (Cole aqui as funções inalteradas da versão anterior)
// ... (Para manter a resposta concisa, vamos focar apenas nas funções novas e alteradas)
async function loadTables() {
    if (!currentUser) return;
    freeTablesList.innerHTML = '<p>Carregando...</p>';
    busyTablesList.innerHTML = '<p>Carregando...</p>';
    try {
        const snapshot = await db.collection('tables').where('ownerId', '==', currentUser.uid).get();
        freeTablesList.innerHTML = '';
        busyTablesList.innerHTML = '';
        if (snapshot.empty) {
            freeTablesList.innerHTML = '<p>Nenhuma mesa cadastrada.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const table = { id: doc.id, ...doc.data() };
            // Adicionar um UUID a cada item do pedido se não existir, para a divisão de conta
            if(table.currentOrder) {
                table.currentOrder.forEach(item => {
                    if (!item.uuid) item.uuid = Math.random().toString(36).substring(2, 9);
                });
            }
            const card = createTableCard(table);
            if (table.status === 'livre') {
                freeTablesList.appendChild(card);
            } else {
                busyTablesList.appendChild(card);
            }
        });
    } catch (error) {
        console.error("Erro ao carregar mesas: ", error);
        freeTablesList.innerHTML = '<p>Erro ao carregar mesas.</p>';
    }
}
function createTableCard(table) {
    const card = document.createElement('div');
    card.className = `table-card ${table.status}`;
    card.dataset.id = table.id;
    const statusText = table.status === 'livre' ? 'Livre' : 'Em Atendimento';
    const itemsCount = table.currentOrder ? table.currentOrder.length : 0;
    card.innerHTML = `
        <div class="table-card-info">
            <h4>${table.name}</h4>
            <p>Status: ${statusText}</p>
            ${table.status !== 'livre' ? `<p>Itens: ${itemsCount}</p>` : ''}
        </div>
        <button class="btn btn-primary btn-sm">Abrir</button>
    `;
    card.addEventListener('click', () => openTable(table.id));
    return card;
}
async function submitTable() {
    const name = tableNameEntry.value.trim();
    if (!name) {
        statusLabel.textContent = "O nome da mesa é obrigatório!";
        statusLabel.style.color = "#EF4444";
        return;
    }
    const tableData = { name: name, status: "livre", currentOrder: [], ownerId: currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    try {
        await db.collection('tables').add(tableData);
        statusLabel.textContent = "Mesa cadastrada com sucesso!";
        statusLabel.style.color = "#10B981";
        tableNameEntry.value = '';
        loadTables();
    } catch (error) {
        console.error("Erro ao cadastrar mesa: ", error);
        statusLabel.textContent = "Falha ao cadastrar mesa.";
        statusLabel.style.color = "#EF4444";
    }
}
async function openTable(tableId) {
    try {
        const doc = await db.collection('tables').doc(tableId).get();
        if (doc.exists) {
            selectedTable = { id: doc.id, ...doc.data() };
             if(selectedTable.currentOrder) {
                selectedTable.currentOrder.forEach(item => {
                    if (!item.uuid) item.uuid = Math.random().toString(36).substring(2, 9);
                });
            }
            updateDetailsPanel();
            tableDetailsPanel.style.display = 'flex';
        } else {
            alert("Mesa não encontrada. Pode ter sido excluída.");
            loadTables();
        }
    } catch(error) {
        console.error("Erro ao abrir mesa: ", error);
        alert("Erro ao abrir a mesa.");
    }
}
function closeDetailsPanel() {
    tableDetailsPanel.style.display = 'none';
    selectedTable = null;
}
function updateDetailsPanel() {
    if (!selectedTable) return;
    tableInfoLabel.textContent = `Mesa: ${selectedTable.name} | Status: ${selectedTable.status}`;
    orderTree.innerHTML = '';
    let total = 0;
    if (selectedTable.currentOrder && selectedTable.currentOrder.length > 0) {
        selectedTable.currentOrder.forEach((item, index) => {
            const subtotal = item.price * item.quantity;
            total += subtotal;
            const li = document.createElement('li');
            li.dataset.index = index;
            li.innerHTML = `
                <span>${item.quantity}x ${item.name}</span>
                <div class="item-details">
                    <span>R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
                    <button class="remove-item-btn" title="Remover item">×</button>
                </div>
            `;
            orderTree.appendChild(li);
        });
    } else {
        orderTree.innerHTML = '<li>Nenhum item no pedido.</li>';
    }
    totalLabel.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
}

// --- LÓGICA DE DIVISÃO DE CONTA ---
function showSplitBillModal() {
    if (!selectedTable.currentOrder || selectedTable.currentOrder.length === 0) {
        alert("Não há itens na mesa para dividir.");
        return;
    }
    splitBillData.unpaid = [...selectedTable.currentOrder];
    splitBillData.paying = [];
    splitBillTitle.textContent = `Dividir Conta - Mesa: ${selectedTable.name}`;
    updateSplitBillUI();
    splitBillModal.style.display = 'flex';
}

function updateSplitBillUI() {
    unpaidItemsList.innerHTML = '';
    splitBillData.unpaid.forEach(item => unpaidItemsList.appendChild(createSplitItemLi(item)));

    payingItemsList.innerHTML = '';
    splitBillData.paying.forEach(item => payingItemsList.appendChild(createSplitItemLi(item)));

    const splitTotal = splitBillData.paying.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    splitTotalLabel.textContent = `Subtotal a Pagar: R$ ${splitTotal.toFixed(2).replace('.', ',')}`;
}

function createSplitItemLi(item) {
    const li = document.createElement('li');
    li.dataset.uuid = item.uuid;
    const subtotal = item.price * item.quantity;
    li.innerHTML = `<span>${item.quantity}x ${item.name}</span> <span>R$ ${subtotal.toFixed(2).replace('.',',')}</span>`;
    return li;
}

function moveItemToPaying(uuid) {
    if (!uuid) return;
    const itemIndex = splitBillData.unpaid.findIndex(item => item.uuid === uuid);
    if (itemIndex > -1) {
        const [item] = splitBillData.unpaid.splice(itemIndex, 1);
        splitBillData.paying.push(item);
        updateSplitBillUI();
    }
}

function moveItemToUnpaid(uuid) {
    if (!uuid) return;
    const itemIndex = splitBillData.paying.findIndex(item => item.uuid === uuid);
    if (itemIndex > -1) {
        const [item] = splitBillData.paying.splice(itemIndex, 1);
        splitBillData.unpaid.push(item);
        updateSplitBillUI();
    }
}

function handlePaySplit() {
    if (splitBillData.paying.length === 0) {
        alert("Selecione pelo menos um item para pagar.");
        return;
    }
    const total = splitBillData.paying.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    showPaymentModal(splitBillData.paying, total, 'partial');
}


// --- LÓGICA DE PAGAMENTO ---
function handleFinalizeSale() {
    if (!selectedTable.currentOrder || selectedTable.currentOrder.length === 0) {
        alert("A mesa está vazia, não há o que finalizar.");
        return;
    }
    const total = selectedTable.currentOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    showPaymentModal(selectedTable.currentOrder, total, 'full');
}

function showPaymentModal(items, total, type) {
    paymentData = { items, total, type, paymentMethod: null };

    paymentTotal.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
    amountPaidInput.value = '';
    changeDisplay.textContent = 'Troco: R$ 0,00';
    cashPaymentFields.style.display = 'none';
    
    // Resetar botões de pagamento
    document.querySelectorAll('.payment-methods .btn').forEach(b => b.classList.remove('active'));
    confirmPaymentBtn.disabled = true;

    paymentModal.style.display = 'flex';
}

function selectPaymentMethod(event) {
    const button = event.target.closest('button');
    if (!button) return;

    paymentData.paymentMethod = button.dataset.method;
    
    document.querySelectorAll('.payment-methods .btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    
    cashPaymentFields.style.display = (paymentData.paymentMethod === 'Dinheiro') ? 'block' : 'none';
    confirmPaymentBtn.disabled = false;
}

function calculateChange() {
    const amountPaid = parseFloat(amountPaidInput.value) || 0;
    const change = amountPaid - paymentData.total;
    changeDisplay.textContent = `Troco: R$ ${change >= 0 ? change.toFixed(2).replace('.', ',') : '0,00'}`;
}

async function processPayment() {
    if (!paymentData.paymentMethod) {
        alert("Selecione uma forma de pagamento.");
        return;
    }

    confirmPaymentBtn.disabled = true;
    confirmPaymentBtn.textContent = 'Processando...';

    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const saleData = {
        date: formattedDate,
        total: paymentData.total,
        userId: currentUser.uid,
        paymentMethod: paymentData.paymentMethod,
        items: paymentData.items,
        customerName: `Mesa ${selectedTable.name}`,
        tableId: selectedTable.id
    };

    try {
        await db.collection('sales').add(saleData);

        if (paymentData.type === 'full') {
            // [MODIFICADO] Ação para pagamento completo: excluir a mesa
            await db.collection('tables').doc(selectedTable.id).delete();

        } else { // Pagamento parcial: remover apenas os itens pagos
            const remainingItems = selectedTable.currentOrder.filter(
                tableItem => !paymentData.items.some(paidItem => paidItem.uuid === tableItem.uuid)
            );
            await db.collection('tables').doc(selectedTable.id).update({
                currentOrder: remainingItems
            });
        }

        alert("Pagamento realizado com sucesso!");
        // Fechar todos os modais e recarregar
        paymentModal.style.display = 'none';
        splitBillModal.style.display = 'none';
        tableDetailsPanel.style.display = 'none';
        loadTables();

    } catch (error) {
        alert("Ocorreu um erro ao processar o pagamento.");
        console.error("Erro ao processar pagamento: ", error);
    } finally {
        confirmPaymentBtn.disabled = false;
        confirmPaymentBtn.textContent = 'Confirmar Pagamento';
    }
}


// --- Funções Auxiliares (como removeItem, deleteTable, etc.) ---
// ... (Cole aqui as funções inalteradas da versão anterior)
// ...
async function removeItem(itemIndex) {
    selectedTable.currentOrder.splice(itemIndex, 1);
    const newStatus = selectedTable.currentOrder.length > 0 ? 'em atendimento' : 'livre';
    try {
        await db.collection('tables').doc(selectedTable.id).update({
            currentOrder: selectedTable.currentOrder,
            status: newStatus
        });
        selectedTable.status = newStatus;
        updateDetailsPanel();
        loadTables();
    } catch(error) {
        alert("Falha ao remover item.");
        console.error(error);
    }
}
async function deleteTable() {
    if (selectedTable.currentOrder && selectedTable.currentOrder.length > 0) {
        alert("Finalize ou esvazie a venda antes de excluir a mesa!");
        return;
    }
    if (confirm(`Tem certeza que deseja excluir a mesa "${selectedTable.name}"?`)) {
        try {
            await db.collection('tables').doc(selectedTable.id).delete();
            alert("Mesa excluída com sucesso!");
            closeDetailsPanel();
            loadTables();
        } catch (error) {
            alert("Falha ao excluir a mesa.");
            console.error(error);
        }
    }
}
async function confirmProduct() {
    const selectedLi = document.querySelector('#productTree li.selected');
    if (!selectedLi) {
        alert("Selecione um produto!");
        return;
    }
    const quantity = parseInt(quantityEntry.value, 10);
    if (isNaN(quantity) || quantity <= 0) {
        alert("Quantidade inválida!");
        return;
    }
    const productId = selectedLi.dataset.id;
    const product = allProducts.find(p => p.id === productId);
    const newItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        subtotal: product.price * quantity,
        uuid: Math.random().toString(36).substring(2, 9) // Garante UUID na criação
    };
    const newOrder = selectedTable.currentOrder ? [...selectedTable.currentOrder, newItem] : [newItem];
    try {
        await db.collection('tables').doc(selectedTable.id).update({
            currentOrder: newOrder,
            status: 'em atendimento'
        });
        selectedTable.currentOrder = newOrder;
        selectedTable.status = 'em atendimento';
        updateDetailsPanel();
        hideProductModal();
        loadTables();
    } catch (error) {
        console.error("Erro ao adicionar produto: ", error);
        alert("Falha ao adicionar o produto ao pedido.");
    }
}
function hideProductModal() {
    addProductModal.style.display = 'none';
}
function searchProducts() {
    const query = productSearchEntry.value.toLowerCase();
    const filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(query));
    productTree.innerHTML = '';
    filteredProducts.forEach(product => {
        const li = document.createElement('li');
        li.dataset.id = product.id;
        li.textContent = `${product.name} - R$ ${product.price.toFixed(2)}`;
        li.addEventListener('click', () => {
            document.querySelectorAll('#productTree li').forEach(item => item.classList.remove('selected'));
            li.classList.add('selected');
        });
        productTree.appendChild(li);
    });
}
function handleOrderClick(event) {
    if (event.target.classList.contains('remove-item-btn')) {
        const itemLi = event.target.closest('li');
        if (itemLi && itemLi.dataset.index) {
            const itemIndex = parseInt(itemLi.dataset.index, 10);
            removeItem(itemIndex);
        }
    }
}
async function preloadProducts() {
    try {
        const snapshot = await db.collection('products').where('ownerId', '==', currentUser.uid).get();
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch(error) {
        console.error("Erro ao pré-carregar produtos:", error);
    }
}
function showProductModal() {
    if (!selectedTable) {
        alert("Selecione uma mesa primeiro!");
        return;
    }
    productSearchEntry.value = '';
    quantityEntry.value = '1';
    searchProducts();
    addProductModal.style.display = 'flex';
}

document.addEventListener('touchmove', function (event) {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });