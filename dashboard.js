let sidebarOpen = false;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.getElementById('mainContent');

    sidebarOpen = !sidebarOpen;

    if (sidebarOpen) {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        if (window.innerWidth > 768) {
            mainContent.classList.add('shifted');
        }
    } else {
        closeSidebar();
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.getElementById('mainContent');

    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    mainContent.classList.remove('shifted');
    sidebarOpen = false;
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            closeSidebar();
        }
        document.querySelectorAll('.nav-item').forEach(navItem => {
            navItem.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
    });
});

window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
        document.getElementById('mainContent').classList.remove('shifted');
    } else if (sidebarOpen) {
        document.getElementById('mainContent').classList.add('shifted');
    }
});

const firebaseConfig = {
  apiKey: "AIzaSyAg0DdzFPBnGyEe_aLhVIwU5Ksljd0jTkY",
  authDomain: "smart-point-pdv-ed911.firebaseapp.com",
  databaseURL: "https://smart-point-pdv-ed911-default-rtdb.firebaseio.com",
  projectId: "smart-point-pdv-ed911",
  storageBucket: "smart-point-pdv-ed911.firebasestorage.app",
  messagingSenderId: "308482043681",
  appId: "1:308482043681:web:0505c90795b9151e7b9860"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Função para buscar e exibir o nome da loja (estabelecimento) e o logo
async function displayStoreName(database, authInstance) {
    const storeNameElement = document.getElementById('storeNameElement');
    const storeLogoElement = document.getElementById('storeLogoElement'); // Get the new logo element

    // Set default states
    if (storeNameElement) storeNameElement.textContent = "N/A";
    if (storeLogoElement) {
        storeLogoElement.style.display = 'none';
        storeLogoElement.src = ''; // Clear previous image
    }

    if (!authInstance.currentUser) {
        // User is not logged in, elements are already set to default/logged-out state
        return;
    }

    try {
        const establishmentRef = database.collection('establishment')
                                     .where('ownerId', '==', authInstance.currentUser.uid)
                                     .limit(1);
        const snapshot = await establishmentRef.get();

        let storeName = "Minha Loja"; // Default store name
        let logoUrl = "";             // Default logo URL

        if (!snapshot.empty) {
            const establishmentDoc = snapshot.docs[0].data();
            storeName = establishmentDoc.tradeName || storeName; 
            
            // IMPORTANT: Check your Firestore document for the correct field name for the logo URL.
            // Common names are 'logoUrl', 'photoURL', 'storeLogo', etc.
            // Adjust 'establishmentDoc.logoUrl' or 'establishmentDoc.photoURL' below if needed.
            logo = establishmentDoc.logo || establishmentDoc.photoURL || ""; 
        } else {
            console.log("Nenhum documento de estabelecimento encontrado para o usuário.");
            // storeName will remain "Minha Loja" or you can set a specific message.
        }
        
        if (storeNameElement) {
            storeNameElement.textContent = storeName;
        }

        if (storeLogoElement) {
            if (logo) {
                storeLogoElement.src = logo;
                storeLogoElement.alt = `Logo de ${storeName}`; // Set dynamic alt text
                storeLogoElement.style.display = 'block'; // Show the logo image element
            } else {
                // storeLogoElement.style.display = 'none'; // Already set by default
                console.log("URL do logo não encontrada no documento do estabelecimento.");
            }
        }

    } catch (error) {
        console.error("Erro ao buscar nome/logo da loja:", error);
        if (storeNameElement) storeNameElement.textContent = "Erro ao carregar";
        // storeLogoElement.style.display = 'none'; // Ensure logo is hidden on error
    }
}

auth.onAuthStateChanged((user) => {
    if (!user) {
        // Limpa os dados do dashboard quando o usuário está deslogado
        const storeNameElement = document.getElementById('storeNameElement');
        if (storeNameElement) storeNameElement.textContent = "N/A";
        
        document.getElementById('numeroVendas').textContent = '0';
        document.getElementById('numeroMesas').textContent = '0';
        document.getElementById('totalMesasValor').textContent = 'R$ 0,00';
        document.getElementById('produtosMaisVendidos').innerHTML = '<li>N/A</li>';
        document.getElementById('metodosPagamentoMaisUsados').innerHTML = '<li>N/A</li>';
        
        // Limpa as informações de login
        document.getElementById('lastLoginDate').textContent = '--/--/----';
        document.getElementById('lastLoginTime').textContent = '--:--:--';
    } else {
        // Exibe os dados do dashboard quando o usuário está logado
        displayStoreName(db, auth);
        updateDashboardData(db, auth);
        displayUserLoginInfo(user); // <<--- CHAMA A NOVA FUNÇÃO AQUI
    }
});

function logout() {
    auth.signOut().then(() => {
        window.location.href = '/login.html';
    }).catch((error) => {
    });
}

// Em dashboard.js

async function updateDashboardData(database, authInstance) {
    if (!authInstance.currentUser) {
        return;
    }
    const currentUserId = authInstance.currentUser.uid;

    try {
        // --- INÍCIO DA MODIFICAÇÃO ---

        // Pega a data de hoje no formato YYYY-MM-DD
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Cria as strings de início e fim do dia para a consulta no Firebase
        const startOfDay = `${todayStr} 00:00:00`;
        const endOfDay = `${todayStr} 23:59:59`;

        // Altera a consulta para filtrar as vendas pela data de hoje
        const salesSnapshot = await database.collection('sales')
                                        .where('userId', '==', currentUserId)
                                        .where('date', '>=', startOfDay) // Adiciona o filtro de data inicial
                                        .where('date', '<=', endOfDay)   // Adiciona o filtro de data final
                                        .get();
        
        // --- FIM DA MODIFICAÇÃO ---
        
        if (salesSnapshot.empty) {
            // Se não houver vendas hoje, zera os valores
            document.getElementById('numeroVendas').textContent = '0';
            document.getElementById('totalMesasValor').textContent = 'R$ 0,00';
            document.getElementById('produtosMaisVendidos').innerHTML = '<li>Nenhuma venda hoje.</li>';
            document.getElementById('metodosPagamentoMaisUsados').innerHTML = '<li>Nenhuma venda hoje.</li>';
            // O número de mesas continua sendo o total, não apenas as de hoje.
            const tablesSnapshot = await database.collection('tables').where('ownerId', '==', currentUserId).get();
            document.getElementById('numeroMesas').textContent = tablesSnapshot.size;
            return; // Encerra a função aqui
        }
        
        const numeroVendas = salesSnapshot.size;
        const numeroVendasEl = document.getElementById('numeroVendas');
        if (numeroVendasEl) numeroVendasEl.textContent = numeroVendas;

        let overallTotalRevenue = 0; // Receita total das vendas de HOJE
        const produtosInfo = {};
        const metodosInfo = {};

        salesSnapshot.forEach(doc => {
            const saleData = doc.data();
            const saleValue = saleData.total || 0;
            overallTotalRevenue += saleValue;

            // O restante da lógica para agregar produtos e métodos de pagamento continua igual...
            if (saleData.items && Array.isArray(saleData.items)) {
                saleData.items.forEach(item => {
                    const nomeProduto = typeof item === 'string' ? item : item.name;
                    const quantidade = typeof item === 'string' ? 1 : (item.quantity || 1);
                    const itemValue = item.subtotal || ((item.price || 0) * quantidade);

                    if (nomeProduto) {
                        if (!produtosInfo[nomeProduto]) {
                            produtosInfo[nomeProduto] = { count: 0, value: 0 };
                        }
                        produtosInfo[nomeProduto].count += quantidade;
                        produtosInfo[nomeProduto].value += itemValue;
                    }
                });
            }

            const paymentMethodName = saleData.paymentMethod;
            if (paymentMethodName) {
                if (!metodosInfo[paymentMethodName]) {
                    metodosInfo[paymentMethodName] = { count: 0, value: 0 };
                }
                metodosInfo[paymentMethodName].count += 1;
                metodosInfo[paymentMethodName].value += saleValue;
            }
        });

        const totalMesasValorEl = document.getElementById('totalMesasValor');
        if (totalMesasValorEl) totalMesasValorEl.textContent = `R$ ${overallTotalRevenue.toFixed(2).replace('.', ',')}`;

        // O restante do código para exibir os produtos e métodos de pagamento...
        // ... (o código restante da função permanece o mesmo) ...

        // --- Processar e Exibir Produtos Mais Vendidos ---
        const produtosArray = Object.entries(produtosInfo).map(([name, data]) => ({
            name,
            count: data.count,
            value: data.value,
            percentage: overallTotalRevenue > 0 ? (data.value / overallTotalRevenue) * 100 : 0
        }));
        const produtosOrdenados = produtosArray.sort((a, b) => b.value - a.value).slice(0, 3); 

        const produtosListElement = document.getElementById('produtosMaisVendidos');
        if (produtosListElement) {
            produtosListElement.innerHTML = '';
            if (produtosOrdenados.length > 0) {
                produtosOrdenados.forEach(product => {
                    const li = document.createElement('li');
                    li.className = 'product-item-dynamic';

                    let progressBarClass = 'low';
                    if (product.percentage > 55) progressBarClass = 'high';
                    else if (product.percentage > 25) progressBarClass = 'medium';

                    li.innerHTML = `
                        <div class="product-info-dynamic">
                            <span class="product-name-dynamic">${product.name}</span>
                            <div class="product-progress-bar-container-dynamic">
                                <div class="progress-bar-dynamic ${progressBarClass}" style="width: ${product.percentage.toFixed(0)}%;"></div>
                            </div>
                            <span class="product-percentage-dynamic">${product.percentage.toFixed(0)}%</span>
                        </div>
                        <div class="product-value-dynamic">R$${product.value.toFixed(2).replace('.', ',')}</div>
                    `;
                    produtosListElement.appendChild(li);
                });
            } else {
                produtosListElement.innerHTML = '<li>Nenhuma venda hoje.</li>';
            }
        }

        // --- Processar e Exibir Métodos de Pagamento Mais Usados ---
        const metodosArray = Object.entries(metodosInfo).map(([name, data]) => ({
            name,
            count: data.count,
            value: data.value,
            percentage: overallTotalRevenue > 0 ? (data.value / overallTotalRevenue) * 100 : 0
        }));
        const metodosOrdenados = metodosArray.sort((a, b) => b.value - a.value).slice(0, 3);

        const metodosListElement = document.getElementById('metodosPagamentoMaisUsados');
        if (metodosListElement) {
            metodosListElement.innerHTML = '';
             if (metodosOrdenados.length > 0) {
                metodosOrdenados.forEach(method => {
                    const li = document.createElement('li');
                    li.className = 'payment-item-dynamic';

                    let percentageClassColor = 'blue';
                    if (method.name.toLowerCase().includes('dinheiro')) percentageClassColor = 'blue';
                    else if (method.name.toLowerCase().includes('débito') || method.name.toLowerCase().includes('debito')) percentageClassColor = 'coral';
                    else if (method.name.toLowerCase().includes('crédito') || method.name.toLowerCase().includes('credito')) percentageClassColor = 'purple';
                    else percentageClassColor = 'mint';

                    li.innerHTML = `
                        <div class="payment-details-dynamic">
                            <div class="payment-method-name-value-dynamic">${method.name} - R$${method.value.toFixed(2).replace('.', ',')}</div>
                            <div class="payment-method-count-dynamic">${method.count} Vendas</div>
                            <div class="payment-method-percentage-subtitle-dynamic">${method.percentage.toFixed(0)}% do total</div>
                        </div>
                        <div class="payment-percentage-prominent-dynamic ${percentageClassColor}">${method.percentage.toFixed(0)}%</div>
                    `;
                    metodosListElement.appendChild(li);
                });
            } else {
                metodosListElement.innerHTML = '<li>Nenhuma venda hoje.</li>';
            }
        }

        // --- Número de Mesas (tables) ---
        const tablesSnapshot = await database.collection('tables')
                                           .where('ownerId', '==', currentUserId) 
                                           .get();
        const numeroMesas = tablesSnapshot.size;
        const numeroMesasEl = document.getElementById('numeroMesas');
        if (numeroMesasEl) numeroMesasEl.textContent = numeroMesas;

    } catch (error) {
        console.error("Erro ao atualizar dashboard:", error);
        if (error.code === 'failed-precondition') {
             // Este erro específico sugere a falta de um índice
            alert("Erro de banco de dados: Um índice necessário para esta consulta não existe. Verifique o console do navegador para criar o índice.");
            document.getElementById('produtosMaisVendidos').innerHTML = `<li>Erro: Índice do banco de dados ausente.</li>`;
        } else {
            document.getElementById('numeroVendas').textContent = 'Erro';
            document.getElementById('numeroMesas').textContent = 'Erro';
            document.getElementById('totalMesasValor').textContent = 'R$ Erro';
            document.getElementById('produtosMaisVendidos').innerHTML = '<li>Erro ao carregar produtos</li>';
            document.getElementById('metodosPagamentoMaisUsados').innerHTML = '<li>Erro ao carregar pagamentos</li>';
        }
    }
}

setInterval(() => {
    if (auth.currentUser) {
        updateDashboardData(db, auth);
    }
}, 30000);

window.addEventListener('load', () => {
    const elements = document.querySelectorAll('.stat-card, .section');
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'all 0.5s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * 100);
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js'); //
            console.log('PWA: Service Worker registrado com sucesso!', registration);
        } catch (error) {
            console.error('PWA: Falha ao registrar Service Worker:', error); //
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Mantém o preventDefault() que existia no listener original para estes itens.
            e.preventDefault(); 

            const href = item.getAttribute('href');

            if (href && href !== '#') {
                // Se existir um href válido que não seja apenas "#", navega para ele.
                window.location.href = href;
            } else {
                // Para links com href="#" ou sem atributo href,
                // a ação padrão é prevenida.
                // Mensagem no console para indicar que não há redirecionamento configurado.
                console.log(`Sidebar item "${item.textContent.trim()}" clicked. No valid page redirect configured (href: "${href || 'not set'}").`);
            }
        });
    });
});

    document.addEventListener('touchmove', function (event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
    }, { passive: false });

    // Função para exibir as informações de login do usuário
function displayUserLoginInfo(user) {
    const lastLoginDateEl = document.getElementById('lastLoginDate');
    const lastLoginTimeEl = document.getElementById('lastLoginTime');

    // Verifica se o metadado de último login existe no objeto do usuário
    if (user && user.metadata && user.metadata.lastSignInTime) {
        const loginDate = new Date(user.metadata.lastSignInTime);

        // Formata a data para o padrão "dd de Mês de yyyy"
        const formattedDate = loginDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        // Formata a hora para o padrão "hh:mm:ss"
        const formattedTime = loginDate.toLocaleTimeString('pt-BR');

        lastLoginDateEl.textContent = formattedDate;
        lastLoginTimeEl.textContent = formattedTime;
    } else {
        // Se não houver dados, exibe um valor padrão
        lastLoginDateEl.textContent = 'N/A';
        lastLoginTimeEl.textContent = '--:--:--';
    }
}

if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    // Para implementar, você precisará criar um arquivo sw.js
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    console.log('PWA: Service Worker ready for implementation');
                } catch (error) {
                    console.log('PWA: Service Worker registration failed');
                }
            });
        }