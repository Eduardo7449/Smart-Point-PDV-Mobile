document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyAg0DdzFPBnGyEe_aLhVIwU5Ksljd0jTkY", // SUA CHAVE
        authDomain: "smart-point-pdv-ed911.firebaseapp.com",
        projectId: "smart-point-pdv-ed911",
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- VARIÁVEIS DE ESTADO ---
    let currentUser = null;
    let salesData = [];
    let selectedSale = null;

    // --- ELEMENTOS DO DOM ---
    const consultantContainer = document.getElementById('consultant-container');
    const salesListDiv = document.getElementById('sales-list'); // Alterado de tbody para div
    const totalValueSpan = document.getElementById('total-value');
    const detailsPlaceholder = document.getElementById('details-placeholder');
    const detailsContent = document.getElementById('details-content');
    const saleInfoDiv = document.getElementById('sale-info');
    const productsTbody = document.getElementById('products-tbody');
    const cancelBtn = document.getElementById('cancel-btn');
    const backToListBtn = document.getElementById('back-to-list-btn');

    // --- LÓGICA DE AUTENTICAÇÃO ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadSales();
        } else {
            window.location.href = '/login.html';
        }
    });

    /**
     * Carrega as vendas do dia atual para o usuário logado.
     */
    async function loadSales() {
        if (!currentUser) return;
        
        salesListDiv.innerHTML = '<p>Carregando vendas...</p>';

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayString = `${year}-${month}-${day}`;
        const startOfDay = `${todayString} 00:00:00`;
        const endOfDay = `${todayString} 23:59:59`;

        try {
            const q = db.collection('sales')
                .where('userId', '==', currentUser.uid)
                .where('date', '>=', startOfDay)
                .where('date', '<=', endOfDay)
                .orderBy('date', 'desc');

            const snapshot = await q.get();
            salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderSalesList();

        } catch (error) {
            console.error("Erro ao carregar vendas:", error);
            salesListDiv.innerHTML = '<p>Erro ao carregar vendas. Verifique o console (F12).</p>';
        }
    }

    /**
     * Formata a data para "sáb., 05 jul. 2025 HH:MM"
     */
    function formatSaleDate(dateString) {
        const date = new Date(dateString);
        const options = {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        let formatted = new Intl.DateTimeFormat('pt-BR', options).format(date);
        // Remove o ponto final dos meses (ex: "jul." -> "jul")
        formatted = formatted.replace(/\./g, '');
        return formatted;
    }

    /**
     * Renderiza a lista de vendas como cartões.
     */
    function renderSalesList() {
    salesListDiv.innerHTML = '';
    if (salesData.length === 0) {
        salesListDiv.innerHTML = '<p>Nenhuma venda encontrada para o dia de hoje.</p>';
        totalValueSpan.textContent = 'R$ 0,00';
        return;
    }

    let totalSalesValue = 0;

    salesData.forEach(sale => {
        if (sale.status !== 'cancelled') {
            totalSalesValue += sale.total;
        }

        const card = document.createElement('div');
        card.className = 'sale-card';
        card.dataset.saleId = sale.id;
        if (sale.status === 'cancelled') {
            card.classList.add('status-cancelled');
        }

        const customerName = sale.customerName || 'Cliente não informado';
        const vendor = sale.vendor || 'Vendedor não informado';

        // --- ALTERAÇÃO FINAL COM OS ÍCONES CORRETOS ---
        // Adicionamos <i class="ph-user-circle"></i> para o cliente
        // Adicionamos <i class="ph-briefcase"></i> para o vendedor
        card.innerHTML = `
            <div class="card-header">Venda ${sale.saleNumber || 'N/A'}</div>
            <div class="card-date">${formatSaleDate(sale.date)}</div>
            <div class="card-details">
                <span><i class="ph-user-circle"></i> ${customerName}</span>
                <span><i class="ph-briefcase"></i> ${vendor}</span>
            </div>
            <div class="card-price">R$ ${sale.total.toFixed(2).replace('.', ',')}</div>
        `;
        // --- FIM DA ALTERAÇÃO ---

        card.addEventListener('click', () => displaySaleDetails(sale.id));
        salesListDiv.appendChild(card);
    });

    totalValueSpan.textContent = `R$ ${totalSalesValue.toFixed(2).replace('.', ',')}`;

    // Limpa a seleção e os detalhes
    showSalesList();
    detailsPlaceholder.classList.remove('hidden');
    detailsContent.classList.add('hidden');
    cancelBtn.disabled = true;
}


    /**
     * Exibe os detalhes de uma venda selecionada.
     */
    function displaySaleDetails(saleId) {
        selectedSale = salesData.find(s => s.id === saleId);
        if (!selectedSale) return;

        consultantContainer.classList.add('details-active');

        document.querySelectorAll('.sale-card').forEach(card => {
            card.classList.remove('selected');
            if (card.dataset.saleId === saleId) {
                card.classList.add('selected');
            }
        });

        detailsPlaceholder.classList.add('hidden');
        detailsContent.classList.remove('hidden');

        let statusText = selectedSale.status === 'cancelled' ? '<strong class="status-cancelled">CANCELADA</strong>' : 'Finalizada';
        saleInfoDiv.innerHTML = `
            <strong>Venda Nº:</strong> ${selectedSale.saleNumber}<br>
            <strong>Data:</strong> ${new Date(selectedSale.date).toLocaleString('pt-BR')}<br>
            <strong>Total:</strong> R$ ${selectedSale.total.toFixed(2).replace('.', ',')}<br>
            <strong>Pagamento:</strong> ${selectedSale.paymentMethod}<br>
            <strong>Status:</strong> ${statusText}
        `;

        productsTbody.innerHTML = '';
        selectedSale.items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>R$ ${item.price.toFixed(2).replace('.', ',')}</td>
                <td>R$ ${item.subtotal.toFixed(2).replace('.', ',')}</td>
            `;
            productsTbody.appendChild(tr);
        });
        
        cancelBtn.disabled = selectedSale.status === 'cancelled';
    }

    /**
     * Volta para a visualização da lista de vendas no mobile.
     */
    function showSalesList() {
        consultantContainer.classList.remove('details-active');
        selectedSale = null;
        document.querySelectorAll('.sale-card').forEach(card => card.classList.remove('selected'));
    }

    /**
     * Cancela uma venda.
     */
    async function cancelSale() {
        if (!selectedSale || selectedSale.status === 'cancelled') return;

        if (confirm(`Tem certeza que deseja cancelar a Venda Nº ${selectedSale.saleNumber}?`)) {
            try {
                const saleRef = db.collection('sales').doc(selectedSale.id);
                await saleRef.update({ status: 'cancelled' });
                
                alert('Venda cancelada com sucesso!');
                await loadSales(); // Recarrega para atualizar o status e o total
                
            } catch (error) {
                console.error("Erro ao cancelar venda:", error);
                alert("Ocorreu um erro ao cancelar a venda.");
            }
        }
    }
    
    // --- EVENT LISTENERS ---
    cancelBtn.addEventListener('click', cancelSale);
    backToListBtn.addEventListener('click', showSalesList);
});