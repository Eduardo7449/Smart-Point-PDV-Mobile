// Configuração e Inicialização do Firebase (copie do seu dashboard.js)
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

// Variáveis Globais
let currentUser = null;
let paymentMethodsChartInstance = null;

// Elementos da UI
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const generateReportBtn = document.getElementById('generateReportBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const reportsContainer = document.getElementById('reportsContainer');

// --- INICIALIZAÇÃO ---

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        // Define datas padrão para o mês corrente
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
        endDateInput.value = today.toISOString().split('T')[0];
    } else {
        window.location.href = '/login.html';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    generateReportBtn.addEventListener('click', generateReport);
});


// --- LÓGICA PRINCIPAL ---

async function generateReport() {
    if (!currentUser) {
        alert("Você precisa estar logado para gerar relatórios.");
        return;
    }

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!startDate || !endDate) {
        alert("Por favor, selecione as datas de início e fim.");
        return;
    }

    loadingIndicator.style.display = 'block';
    reportsContainer.style.display = 'none';

    try {
        // Formata a data para a query do Firebase, que usa o formato 'YYYY-MM-DD HH:MM:SS'
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        const salesSnapshot = await db.collection('sales')
            .where('userId', '==', currentUser.uid)
            .where('date', '>=', startDateTime)
            .where('date', '<=', endDateTime)
            .orderBy('date', 'desc')
            .get();

        const salesData = salesSnapshot.docs.map(doc => doc.data());
        processAndRenderReports(salesData);

    } catch (error) {
        console.error("Erro ao gerar relatório: ", error);
        alert("Falha ao gerar o relatório. Verifique o console para mais detalhes.");
    } finally {
        loadingIndicator.style.display = 'none';
        reportsContainer.style.display = 'block';
    }
}

function processAndRenderReports(sales) {
    if (sales.length === 0) {
        alert("Nenhuma venda encontrada para o período selecionado.");
        reportsContainer.style.display = 'none';
        return;
    }

    // Acumuladores de dados
    let totalRevenue = 0;
    const salesCount = sales.length;
    const topProducts = {};
    const paymentMethods = {};

    sales.forEach(sale => {
        totalRevenue += sale.total;

        // Processa produtos
        sale.items.forEach(item => {
            if (!topProducts[item.name]) {
                topProducts[item.name] = { quantity: 0, value: 0 };
            }
            topProducts[item.name].quantity += item.quantity;
            topProducts[item.name].value += item.subtotal;
        });

        // Processa formas de pagamento
        const pm = sale.paymentMethod;
        if (!paymentMethods[pm]) {
            paymentMethods[pm] = { count: 0, value: 0 };
        }
        paymentMethods[pm].count++;
        paymentMethods[pm].value += sale.total;
    });

    // Renderiza cada componente do relatório
    renderSummary(totalRevenue, salesCount);
    renderTopProductsTable(topProducts);
    renderAllSalesTable(sales);
    renderPaymentMethodsChart(paymentMethods);
}


// --- FUNÇÕES DE RENDERIZAÇÃO ---

function renderSummary(totalRevenue, salesCount) {
    const averageTicket = salesCount > 0 ? totalRevenue / salesCount : 0;
    document.getElementById('totalRevenue').textContent = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
    document.getElementById('totalSalesCount').textContent = salesCount;
    document.getElementById('averageTicket').textContent = `R$ ${averageTicket.toFixed(2).replace('.', ',')}`;
}

function renderTopProductsTable(products) {
    const tbody = document.querySelector('#topProductsTable tbody');
    tbody.innerHTML = '';

    const sortedProducts = Object.entries(products)
        .sort(([, a], [, b]) => b.value - a.value)
        .slice(0, 10); // Pega os 10 mais vendidos

    sortedProducts.forEach(([name, data]) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${name}</td>
            <td>${data.quantity}</td>
            <td>R$ ${data.value.toFixed(2).replace('.', ',')}</td>
        `;
    });
}

function renderAllSalesTable(sales) {
    const tbody = document.querySelector('#allSalesTable tbody');
    tbody.innerHTML = '';
    sales.forEach(sale => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${sale.date}</td>
            <td>${sale.customerName || 'N/A'}</td>
            <td>${sale.items.length}</td>
            <td>${sale.paymentMethod}</td>
            <td>R$ ${sale.total.toFixed(2).replace('.', ',')}</td>
        `;
    });
}

function renderPaymentMethodsChart(data) {
    const ctx = document.getElementById('paymentMethodsChart').getContext('2d');
    const labels = Object.keys(data);
    const values = labels.map(label => data[label].value);

    if (paymentMethodsChartInstance) {
        paymentMethodsChartInstance.destroy();
    }

    paymentMethodsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor por Forma de Pagamento',
                data: values,
                backgroundColor: ['#1E3A8A', '#3B82F6', '#10B981', '#F59E0B', '#6B7280'],
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

document.addEventListener('touchmove', function (event) {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });