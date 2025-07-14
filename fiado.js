// ARQUIVO fiado.js (REFATORADO)

document.addEventListener('DOMContentLoaded', () => {
    // A configuração do Firebase ainda é necessária para autenticação
    const firebaseConfig = {
      apiKey: "AIzaSyAg0DdzFPBnGyEe_aLhVIwU5Ksljd0jTkY",
      authDomain: "smart-point-pdv-ed911.firebaseapp.com",
      databaseURL: "https://smart-point-pdv-ed911-default-rtdb.firebaseio.com",
      projectId: "smart-point-pdv-ed911",
      storageBucket: "smart-point-pdv-ed911.firebasestorage.app",
      messagingSenderId: "308482043681",
      appId: "1:308482043681:web:0505c90795b9151e7b9860"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    // A conexão direta com o 'db' não é mais necessária aqui!
    // const db = firebase.firestore(); 

    // --- Variáveis Globais ---
    let allCustomers = [];
    let currentCustomerId = null; 
    window.idToken = null; // Guardará o token para o apiClient usar

    // --- Elementos do DOM ---
    const customerTableBody = document.getElementById('customerTableBody');
    const searchInput = document.getElementById('searchInput');
    const debtsModal = document.getElementById('debtsModal');
    const closeDebtsModal = document.getElementById('closeDebtsModal');
    const btnCloseDebtsModalBottom = document.getElementById('btnCloseDebtsModalBottom');
    const debtsTableBody = document.getElementById('debtsTableBody');
    const debtCustomerName = document.getElementById('debtCustomerName');
    const debtTotal = document.getElementById('debtTotal');
    const btnPagarDividas = document.getElementById('btnPagarDividas');
    btnPagarDividas.textContent = "Registrar Pagamento";
    const btnExportarPDF = document.getElementById('btnExportarPDF');

    // --- Funções Auxiliares ---
    function getFormattedDateTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    // --- Funções Principais (Refatoradas) ---
    async function loadCustomers() {
        if (!auth.currentUser) return;
        customerTableBody.innerHTML = '<tr><td colspan="1" style="text-align:center; padding: 20px;">Carregando...</td></tr>';
        try {
            allCustomers = await apiClient.getCustomers(); // DEPOIS: Usa o apiClient
            displayCustomers(allCustomers);
        } catch (error) {
            console.error("ERRO AO CARREGAR CLIENTES PELA API:", error);
            customerTableBody.innerHTML = `<tr><td colspan="1" style="text-align:center; color:red; padding: 20px;">${error.message}</td></tr>`;
        }
    }

    function displayCustomers(customers) {
        customerTableBody.innerHTML = '';
        if (!customers || customers.length === 0) {
            customerTableBody.innerHTML = '<tr><td colspan="1" style="text-align:center; padding: 20px;">Nenhum cliente cadastrado.</td></tr>';
            return;
        }
        customers.forEach(customer => {
            const tr = document.createElement('tr');
            tr.dataset.customerId = customer.id;
            tr.dataset.customerName = customer.name;
            tr.innerHTML = `<td>${customer.name}</td>`;
            tr.addEventListener('click', () => { showDebtsModal(customer.id, customer.name); });
            customerTableBody.appendChild(tr);
        });
    }
    
    function searchCustomers() {
        const searchTerm = searchInput.value.toLowerCase();
        const filtered = allCustomers.filter(c => c.name && c.name.toLowerCase().includes(searchTerm));
        displayCustomers(filtered);
    }

    async function showDebtsModal(customerId, customerName) {
        currentCustomerId = customerId;
        debtCustomerName.textContent = `Extrato de: ${customerName}`;
        debtsTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">Carregando...</td></tr>';
        if (debtsModal) { debtsModal.style.display = 'block'; }
        
        try {
            // DEPOIS: Usa o apiClient para buscar dívidas e pagamentos em paralelo
            const [debts, payments] = await Promise.all([
                apiClient.getDebtsByCustomer(customerId),
                apiClient.getPaymentsByCustomer(customerId)
            ]);

            const transactions = [];
            debts.forEach(debt => transactions.push({ type: 'debt', ...debt, date: new Date(debt.date.replace(" ", "T")) }));
            payments.forEach(payment => transactions.push({ type: 'payment', ...payment, date: new Date(payment.date.replace(" ", "T")) }));
            
            transactions.sort((a, b) => a.date - b.date);
            displayTransactionsInModal(transactions);
            
            const totalDebts = debts.reduce((sum, debt) => sum + debt.total, 0);
            const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
            const outstandingBalance = totalDebts - totalPayments;

            debtTotal.textContent = `Saldo Devedor: R$ ${outstandingBalance.toFixed(2).replace('.', ',')}`;
            btnPagarDividas.disabled = outstandingBalance <= 0;

        } catch (error) {
             debtsTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red; padding: 20px;">${error.message}</td></tr>`;
        }
    }
    
    function displayTransactionsInModal(transactions) {
        debtsTableBody.innerHTML = '';
        if (transactions.length === 0) {
            debtsTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">Nenhuma transação encontrada.</td></tr>';
            return;
        }
        transactions.forEach(tx => {
            const tr = document.createElement('tr');
            const date = tx.date.toLocaleString('pt-BR');
            let description = '';
            let amount = '';
            
            if (tx.type === 'debt') {
                description = `Venda Nº ${tx.saleId || 'N/A'}`;
                amount = `<span style="color: red;">- R$ ${tx.total.toFixed(2).replace('.', ',')}</span>`;
            } else {
                description = `Pagamento (${tx.method || 'N/A'})`;
                amount = `<span style="color: green;">+ R$ ${tx.amount.toFixed(2).replace('.', ',')}</span>`;
            }

            tr.innerHTML = `<td>${date}</td><td>${description}</td><td>${amount}</td>`;
            debtsTableBody.appendChild(tr);
        });
    }
    
    function closeAllModals() {
        if(debtsModal) debtsModal.style.display = 'none';
    }

    // --- Event Listeners e Autenticação ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                window.idToken = await user.getIdToken(); // Pega e armazena o token
                loadCustomers();
            } catch (error) {
                console.error("Erro ao obter token:", error);
                alert("Não foi possível autenticar. Tente fazer login novamente.");
            }
        } else {
            window.idToken = null;
            window.location.href = '/login.html';
        }
    });

    searchInput.addEventListener('input', searchCustomers);
    closeDebtsModal.addEventListener('click', closeAllModals);
    btnCloseDebtsModalBottom.addEventListener('click', closeAllModals);

    btnPagarDividas.addEventListener('click', async () => {
        if (!currentCustomerId) return;
        
        try {
            // Re-busca os dados mais recentes via API para calcular o saldo
            const [debts, payments] = await Promise.all([
                apiClient.getDebtsByCustomer(currentCustomerId),
                apiClient.getPaymentsByCustomer(currentCustomerId)
            ]);
            const totalDebts = debts.reduce((sum, debt) => sum + debt.total, 0);
            const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
            const outstandingBalance = totalDebts - totalPayments;

            if (outstandingBalance <= 0) {
                alert("Não há saldo devedor.");
                return;
            }

            const paymentAmountStr = prompt(`Saldo devedor: R$ ${outstandingBalance.toFixed(2)}\nQual o valor do pagamento?`, outstandingBalance.toFixed(2));
            if (paymentAmountStr === null) return;
            const paymentAmount = parseFloat(paymentAmountStr.replace(',', '.'));

            if (isNaN(paymentAmount) || paymentAmount <= 0 || paymentAmount > outstandingBalance) {
                alert(`Valor de pagamento inválido. Deve ser um número entre 0.01 e ${outstandingBalance.toFixed(2)}.`);
                return;
            }

            const paymentMethod = prompt("Qual a forma de pagamento? (Ex: Dinheiro, Pix, Cartão)");
            if (!paymentMethod) return;

            // DEPOIS: Usa o apiClient para registrar o pagamento
            await apiClient.registerPayment(
                currentCustomerId,
                paymentAmount,
                paymentMethod,
                getFormattedDateTime()
            );

            alert("Pagamento registrado com sucesso!");
            showDebtsModal(currentCustomerId, document.getElementById('debtCustomerName').textContent.replace('Extrato de: ', ''));
            
        } catch (error) {
            console.error("Erro no processo de pagamento:", error);
            alert(`Ocorreu um erro: ${error.message}`);
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target == debtsModal) { closeAllModals(); }
    });
});