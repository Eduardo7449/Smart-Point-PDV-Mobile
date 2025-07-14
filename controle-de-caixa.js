document.addEventListener('DOMContentLoaded', () => {
    // Verifique se o Firebase foi inicializado
    if (typeof firebase === 'undefined') {
        alert("Firebase não foi carregado. Verifique a configuração.");
        return;
    }

    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- Elementos DOM ---
    const cashStatusDiv = document.getElementById('cashStatus');
    const statusText = document.getElementById('statusText');
    const cashBalance = document.getElementById('cashBalance');
    const openCashBtn = document.getElementById('openCashBtn');
    const closeCashBtn = document.getElementById('closeCashBtn');
    const addEntryBtn = document.getElementById('addEntryBtn');
    const addExitBtn = document.getElementById('addExitBtn');
    const viewHistoryBtn = document.getElementById('viewHistoryBtn');
    const salesByMethodList = document.getElementById('salesByMethodList');
    const movementsHistoryList = document.getElementById('movementsHistoryList');

    // Modais
    const inputModal = document.getElementById('inputModal');
    const historyModal = document.getElementById('historyModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalPrompt = document.getElementById('modalPrompt');
    const modalInputAmount = document.getElementById('modalInputAmount');
    const modalInputDesc = document.getElementById('modalInputDesc');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    
    // --- Estado da Aplicação ---
    let currentUser = null;
    let currentCashSession = null;
    let modalConfirmCallback = null;

    // =================================================================
    // AUTENTICAÇÃO
    // =================================================================
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            checkOpenCash();
        } else {
            currentUser = null;
            currentCashSession = null;
            updateUIForLoggedOut();
        }
    });

    // =================================================================
    // FUNÇÕES PRINCIPAIS
    // =================================================================

    /**
     * Verifica no Firestore se existe uma sessão de caixa aberta para o usuário atual.
     * Esta é a função principal que define o estado inicial da página.
     */
    async function checkOpenCash() {
        if (!currentUser) return;
        
        try {
            const snapshot = await db.collection('cash_control')
                .where('userId', '==', currentUser.uid)
                .where('status', '==', 'open')
                .limit(1)
                .get();

            if (snapshot.empty) {
                currentCashSession = null;
                updateUIForClosedCash();
            } else {
                currentCashSession = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                updateUIForOpenCash();
            }
        } catch (error) {
            console.error("Erro ao verificar a sessão de caixa aberta:", error);
            alert("Erro ao verificar o estado do caixa. Verifique o console para mais detalhes.");
        }
    }
    
    /**
     * Abre uma nova sessão de caixa após obter um valor inicial do usuário.
     */
    function openCash() {
        showInputModal(
            "Abrir Caixa",
            "Insira o valor inicial para a abertura do caixa:",
            true, // Mostrar campo de valor
            false, // Ocultar campo de descrição
            async (amount) => {
                const initialAmount = parseFloat(amount);
                if (isNaN(initialAmount) || initialAmount < 0) {
                    alert("Por favor, insira um valor válido.");
                    return;
                }

                try {
                    await db.collection('cash_control').add({
                        userId: currentUser.uid,
                        status: 'open',
                        initialAmount: initialAmount,
                        openDate: firebase.firestore.FieldValue.serverTimestamp(),
                        closeDate: null,
                        finalAmount: null
                    });
                    alert("Caixa aberto com sucesso!");
                    await checkOpenCash(); // Atualiza o estado da página
                } catch (error) {
                    console.error("Erro ao abrir o caixa:", error);
                    alert("Não foi possível abrir o caixa.");
                }
            }
        );
    }
    
    /**
     * Fecha a sessão de caixa atual. Primeiro calcula o saldo esperado
     * e pede confirmação antes de fechar.
     */
    async function closeCash() {
    if (!currentCashSession) return;

    try {
        const { finalBalance, summary } = await calculateBalanceAndSummary();

        // Monta a mensagem de confirmação para o usuário
        const confirmation = confirm(
            `Resumo do Caixa:\n` +
            `------------------------------------\n` +
            `Saldo Inicial: R$ ${summary.initialAmount.toFixed(2)}\n` +
            `+ Vendas Totais: R$ ${summary.salesTotal.toFixed(2)}\n` +
            `+ Entradas Manuais: R$ ${summary.entriesTotal.toFixed(2)}\n` +
            `- Saídas Manuais: R$ ${summary.exitsTotal.toFixed(2)}\n` +
            `------------------------------------\n` +
            `SALDO FINAL CALCULADO: R$ ${finalBalance.toFixed(2)}\n\n` +
            `Deseja fechar o caixa?`
        );

        // Se o usuário confirmar, atualiza o banco de dados
        if (confirmation) {
            await db.collection('cash_control').doc(currentCashSession.id).update({
                status: 'closed',
                finalAmount: finalBalance,
                closeDate: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("Caixa fechado com sucesso!");
            
            // Limpa o estado e atualiza a interface
            currentCashSession = null;
            await checkOpenCash(); 
        }
        // Se o usuário cancelar, nada acontece.

    } catch (error) {
        console.error("Erro ao fechar o caixa:", error);
        alert("Não foi possível fechar o caixa. Verifique o console para mais detalhes.");
    }
}

    /**
     * Registra uma entrada de caixa manual (receita).
     */
    function registerEntry() {
        showInputModal(
            "Registrar Entrada",
            "Insira o valor e a descrição da entrada:",
            true, true,
            async (amount, description) => {
                const entryAmount = parseFloat(amount);
                if (isNaN(entryAmount) || entryAmount <= 0) {
                    alert("Por favor, insira um valor válido.");
                    return;
                }
                
                try {
                    await addMovement('entry', entryAmount, description || 'Entrada');
                    alert("Entrada registrada com sucesso!");
                    updateDataDisplays(); // Apenas atualiza os dados
                } catch (error) {
                    console.error("Erro ao adicionar entrada:", error);
                    alert("Não foi possível registrar a entrada.");
                }
            }
        );
    }

    /**
     * Registra uma saída de caixa manual (despesa).
     */
    function registerExit() {
        showInputModal(
            "Registrar Saída",
            "Insira o valor e a descrição da saída (ex: sangria, pagamento):",
            true, true,
            async (amount, description) => {
                const exitAmount = parseFloat(amount);
                if (isNaN(exitAmount) || exitAmount <= 0) {
                    alert("Por favor, insira um valor válido.");
                    return;
                }
                 if (!description) {
                    alert("A descrição é obrigatória para saídas.");
                    return;
                }

                try {
                    await addMovement('exit', exitAmount, description);
                    alert("Saída registrada com sucesso!");
                    updateDataDisplays(); // Apenas atualiza os dados
                } catch (error) {
                    console.error("Erro ao adicionar saída:", error);
                    alert("Não foi possível registrar a saída.");
                }
            }
        );
    }
    
    /**
     * Função genérica para adicionar um documento de movimento ao Firestore.
     */
    async function addMovement(type, amount, description) {
         if (!currentCashSession) return;
         await db.collection('cash_movements').add({
            cashSessionId: currentCashSession.id,
            userId: currentUser.uid,
            type: type,
            amount: amount,
            description: description,
            date: firebase.firestore.FieldValue.serverTimestamp()
         });
    }

    /**
     * Busca e exibe todas as sessões de caixa passadas em um modal.
     */
    async function showCashHistory() {
    if (!currentUser) return;
    try {
        const snapshot = await db.collection('cash_control')
            .where('userId', '==', currentUser.uid)
            .orderBy('openDate', 'desc')
            .get();
        
        const container = document.getElementById('cashHistoryTableContainer');
        if(snapshot.empty) {
            container.innerHTML = '<p>Nenhum histórico de caixa encontrado.</p>';
        } else {
            let tableHTML = `
                <table border="1" style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr><th>Abertura</th><th>Fechamento</th><th>Valor Inicial</th><th>Valor Final</th><th>Status</th></tr>
                    </thead>
                    <tbody>`;
            
            snapshot.docs.forEach(doc => {
                const data = doc.data();

                // --- CORREÇÃO APLICADA AQUI ---
                // Verifica o tipo da data antes de formatar para evitar o erro.
                let openDate = 'N/A';
                if (data.openDate) {
                    const dateToFormat = data.openDate.toDate ? data.openDate.toDate() : new Date(data.openDate);
                    openDate = isNaN(dateToFormat) ? 'Data inválida' : dateToFormat.toLocaleString('pt-BR');
                }

                let closeDate = '-';
                if (data.closeDate) {
                    const dateToFormat = data.closeDate.toDate ? data.closeDate.toDate() : new Date(data.closeDate);
                    closeDate = isNaN(dateToFormat) ? 'Data inválida' : dateToFormat.toLocaleString('pt-BR');
                }
                // --- FIM DA CORREÇÃO ---

                tableHTML += `
                    <tr>
                        <td>${openDate}</td>
                        <td>${closeDate}</td>
                        <td>R$ ${data.initialAmount ? data.initialAmount.toFixed(2) : '0.00'}</td>
                        <td>R$ ${data.finalAmount ? data.finalAmount.toFixed(2) : '-'}</td>
                        <td>${data.status === 'open' ? 'Aberto' : 'Fechado'}</td>
                    </tr>`;
            });
            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
        }
        historyModal.style.display = 'block';

    } catch (error) {
        console.error("Erro ao buscar histórico de caixas:", error);
        alert("Erro ao buscar histórico de caixas.");
    }
}

    /**
     * Converte uma string de data para um objeto Date de forma segura.
     */
    function parseDateStringSafely(dateStr) {
        if (!dateStr) return null;
        // Tenta converter de formatos comuns, incluindo Timestamps do Firestore
        if (dateStr.toDate && typeof dateStr.toDate === 'function') {
            return dateStr.toDate();
        }
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date;
        }
        console.warn(`Formato de data não reconhecido: '${dateStr}'`);
        return null;
    }

    /**
     * Realiza todos os cálculos necessários para a sessão atual.
     * @returns {Promise<{finalBalance: number, summary: object}>}
     */
    async function calculateBalanceAndSummary() {
        if (!currentCashSession || !currentUser) return { finalBalance: 0, summary: {} };

        // Garante que openDate seja um objeto Date, seja de um Timestamp ou de uma string/Date
        const openDate = currentCashSession.openDate && typeof currentCashSession.openDate.toDate === 'function'
            ? currentCashSession.openDate.toDate()
            : new Date(currentCashSession.openDate);

        if (isNaN(openDate.getTime())) {
            console.error("Data de abertura do caixa inválida:", currentCashSession.openDate);
            return { finalBalance: 0, summary: {} };
        }

        // 1. Obter movimentações (entradas/saídas)
        // **ALTERAÇÃO CRÍTICA**: Adicionado filtro por 'userId' para obedecer às regras de segurança.
        const movementsSnapshot = await db.collection('cash_movements')
            .where('userId', '==', currentUser.uid)
            .where('cashSessionId', '==', currentCashSession.id)
            .get();
            
        let entriesTotal = 0;
        let exitsTotal = 0;
        const movementsList = [];
        movementsSnapshot.docs.forEach(doc => {
            const movement = doc.data();
            movementsList.push(movement);
            if (movement.type === 'entry') entriesTotal += movement.amount;
            else if (movement.type === 'exit') exitsTotal += movement.amount;
        });

        // 2. Obter vendas
        const salesSnapshot = await db.collection('sales').where('userId', '==', currentUser.uid).get();
        let salesTotal = 0;
        const salesByMethod = {};
        salesSnapshot.docs.forEach(doc => {
            const sale = doc.data();
            const saleDate = parseDateStringSafely(sale.date);
            // Filtra vendas que ocorreram após a abertura do caixa
            if (saleDate && saleDate >= openDate) {
                salesTotal += sale.total;
                const method = sale.paymentMethod || 'Não especificado';
                salesByMethod[method] = (salesByMethod[method] || 0) + sale.total;
            }
        });
        
        const initialAmount = currentCashSession.initialAmount;
        const finalBalance = initialAmount + salesTotal + entriesTotal - exitsTotal;
        
        return {
            finalBalance,
            summary: {
                initialAmount,
                salesTotal,
                entriesTotal,
                exitsTotal,
                salesByMethod,
                movements: movementsList
            }
        };
    }
    
    /**
     * Atualiza todas as exibições de dados para uma sessão de caixa aberta.
     */
    async function updateDataDisplays() {
        if (!currentCashSession) return;
        
        const { finalBalance, summary } = await calculateBalanceAndSummary();

        cashBalance.textContent = `R$ ${finalBalance.toFixed(2).replace('.', ',')}`;

        // Atualiza lista de vendas por método
        salesByMethodList.innerHTML = '';
        const salesList = document.createElement('ul');
        if (Object.keys(summary.salesByMethod).length > 0) {
            for (const [method, total] of Object.entries(summary.salesByMethod)) {
                const li = document.createElement('li');
                li.innerHTML = `<span>${method}</span> <strong>R$ ${total.toFixed(2)}</strong>`;
                salesList.appendChild(li);
            }
        } else {
            salesList.innerHTML = '<p>Nenhuma venda registrada nesta sessão.</p>';
        }
        salesByMethodList.appendChild(salesList);

        // Atualiza histórico de movimentações manuais
        movementsHistoryList.innerHTML = '';
        const movList = document.createElement('ul');
        if (summary.movements && summary.movements.length > 0) {
            summary.movements.sort((a,b) => a.date - b.date).forEach(mov => {
                const li = document.createElement('li');
                li.classList.add(mov.type);
                const sign = mov.type === 'entry' ? '+' : '-';
                li.innerHTML = `<span>${mov.description}</span> <strong>${sign} R$ ${mov.amount.toFixed(2)}</strong>`;
                movList.appendChild(li);
            });
        } else {
            movList.innerHTML = '<p>Nenhuma movimentação manual registrada.</p>';
        }
        movementsHistoryList.appendChild(movList);
    }
    
    /**
     * Gera um relatório HTML e o abre em uma nova aba para impressão.
     */
    function printCashReport(reportWindow, summary, finalBalance) {
    // A função agora recebe a janela, não a cria mais.
    if (!reportWindow || reportWindow.closed) {
        alert("A janela de impressão foi fechada antes da conclusão. O relatório não pôde ser gerado.");
        return;
    }

    const openDate = currentCashSession.openDate.toDate ? currentCashSession.openDate.toDate().toLocaleString('pt-BR') : new Date(currentCashSession.openDate).toLocaleString('pt-BR');
    
    // Sobrescreve o conteúdo da janela com o relatório final
    reportWindow.document.open();
    reportWindow.document.write(`
        <html>
            <head><title>Relatório de Fechamento de Caixa</title></head>
            <body style="font-family: monospace; padding: 20px;">
                <h3>Relatório de Fechamento de Caixa</h3>
                <p>----------------------------------------</p>
                <p>Abertura: ${openDate}</p>
                <p>Fechamento: ${new Date().toLocaleString('pt-BR')}</p>
                <p>----------------------------------------</p>
                <p>Saldo Inicial: R$ ${summary.initialAmount.toFixed(2)}</p>
                <p>+ Vendas Totais: R$ ${summary.salesTotal.toFixed(2)}</p>
                <p>+ Entradas: R$ ${summary.entriesTotal.toFixed(2)}</p>
                <p>- Saídas: R$ ${summary.exitsTotal.toFixed(2)}</p>
                <p>========================================</p>
                <p><strong>SALDO FINAL: R$ ${finalBalance.toFixed(2)}</strong></p>
                <p>----------------------------------------</p>
                <h4>Vendas por Método</h4>
                ${Object.entries(summary.salesByMethod).length > 0
                    ? Object.entries(summary.salesByMethod).map(([method, total]) => `<p>${method}: R$ ${total.toFixed(2)}</p>`).join('')
                    : '<p>Nenhuma venda registrada.</p>'}
                <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
            </body>
        </html>
    `);
    reportWindow.document.close();
}

    // =================================================================
    // FUNÇÕES DE ATUALIZAÇÃO DA UI
    // =================================================================

    function updateUIForOpenCash() {
        cashStatusDiv.className = 'cash-status open';
        statusText.textContent = 'Caixa Aberto';
        
        openCashBtn.disabled = true;
        closeCashBtn.disabled = false;
        addEntryBtn.disabled = false;
        addExitBtn.disabled = false;

        updateDataDisplays();
    }
    
    function updateUIForClosedCash() {
        cashStatusDiv.className = 'cash-status closed';
        statusText.textContent = 'Caixa Fechado';
        cashBalance.textContent = 'R$ 0,00';
        
        openCashBtn.disabled = false;
        closeCashBtn.disabled = true;
        addEntryBtn.disabled = true;
        addExitBtn.disabled = true;
        
        salesByMethodList.innerHTML = '<p>Abra o caixa para ver as vendas.</p>';
        movementsHistoryList.innerHTML = '<p>Abra o caixa para registrar movimentações.</p>';
    }

    function updateUIForLoggedOut() {
        updateUIForClosedCash();
        statusText.textContent = 'Usuário desconectado';
        openCashBtn.disabled = true;
        viewHistoryBtn.disabled = true;
    }


    // =================================================================
    // FUNÇÕES AUXILIARES DE MODAL
    // =================================================================
    function showInputModal(title, prompt, showAmount, showDesc, callback) {
        modalTitle.textContent = title;
        modalPrompt.textContent = prompt;
        modalInputAmount.style.display = showAmount ? 'block' : 'none';
        modalInputDesc.style.display = showDesc ? 'block' : 'none';
        
        modalInputAmount.value = '';
        modalInputDesc.value = '';

        modalConfirmCallback = () => {
            callback(modalInputAmount.value, modalInputDesc.value);
            hideModals();
        };
        
        inputModal.style.display = 'block';
        if (showAmount) {
            modalInputAmount.focus();
        } else {
            modalInputDesc.focus();
        }
    }

    function hideModals() {
        inputModal.style.display = 'none';
        historyModal.style.display = 'none';
        modalConfirmCallback = null;
    }

    // --- Event Listeners ---
    openCashBtn.addEventListener('click', openCash);
    closeCashBtn.addEventListener('click', closeCash);
    addEntryBtn.addEventListener('click', registerEntry);
    addExitBtn.addEventListener('click', registerExit);
    viewHistoryBtn.addEventListener('click', showCashHistory);
    modalConfirmBtn.addEventListener('click', () => modalConfirmCallback && modalConfirmCallback());
    document.querySelectorAll('.modal .close-button').forEach(btn => btn.addEventListener('click', hideModals));
    window.addEventListener('click', (event) => {
        if (event.target == inputModal || event.target == historyModal) {
            hideModals();
        }
    });

    document.addEventListener('touchmove', function (event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
    }, { passive: false });

});