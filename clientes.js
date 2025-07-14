// customers.js

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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- Elementos da UI ---
const customerListContainer = document.getElementById('customerListContainer');
const editCustomerContainer = document.getElementById('editCustomerContainer');
const customerTableBody = document.getElementById('customerTableBody');
const searchEntry = document.getElementById('searchEntry');

// Modal de Novo Cliente
const newCustomerModal = document.getElementById('newCustomerModal');
const newCustomerForm = document.getElementById('newCustomerForm');
const openNewCustomerModalBtn = document.getElementById('openNewCustomerModalBtn');
const closeNewCustomerModalBtn = document.getElementById('closeNewCustomerModalBtn');
const cancelNewCustomerBtn = document.getElementById('cancelNewCustomerBtn');
const newCustomerStatus = document.getElementById('newCustomerStatus');

// Formulário de Edição
const editCustomerForm = document.getElementById('editCustomerForm');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// --- Estado Global ---
let currentUser = null;
let allCustomers = []; // Cache local para a pesquisa

// --- INICIALIZAÇÃO E AUTENTICAÇÃO ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loadCustomers();
    } else {
        window.location.href = '/login.html';
    }
});

// --- CARREGAMENTO E EXIBIÇÃO DOS DADOS ---
async function loadCustomers() {
    try {
        const snapshot = await db.collection('customers').where('ownerId', '==', currentUser.uid).get();
        allCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTable(allCustomers);
    } catch (error) {
        console.error("Erro ao carregar clientes: ", error);
        customerTableBody.innerHTML = `<tr><td colspan="6">Erro ao carregar dados.</td></tr>`;
    }
}

function renderTable(customers) {
    customerTableBody.innerHTML = '';
    if (customers.length === 0) {
        customerTableBody.innerHTML = `<tr><td colspan="6">Nenhum cliente cadastrado.</td></tr>`;
        return;
    }

    customers.forEach(customer => {
        const tr = document.createElement('tr');
        tr.dataset.id = customer.id;

        let regDate = 'N/A';
        if (customer.createdAt && customer.createdAt.toDate) {
             regDate = customer.createdAt.toDate().toLocaleDateString('pt-BR');
        } else if(customer.registration_date) { // Compatibilidade com formato antigo
            regDate = new Date(customer.registration_date).toLocaleDateString('pt-BR');
        }

        tr.innerHTML = `
            <td data-label="Nome">${customer.name}</td>
            <td data-label="Email">${customer.email || 'N/A'}</td>
            <td data-label="Telefone">${customer.phone || 'N/A'}</td>
            <td data-label="CPF/CNPJ">${customer.cpfCnpj || 'N/A'}</td>
            <td data-label="Data Cadastro">${regDate}</td>
            <td class="actions-cell">
                <button class="btn btn-primary edit-btn">Editar</button>
                <button class="btn btn-danger delete-btn">Apagar</button>
            </td>
        `;
        customerTableBody.appendChild(tr);
    });
}

// --- PESQUISA (FILTRO) ---
searchEntry.addEventListener('keyup', () => {
    const searchTerm = searchEntry.value.toLowerCase();
    const filteredCustomers = allCustomers.filter(customer => {
        return (
            customer.name.toLowerCase().includes(searchTerm) ||
            (customer.email && customer.email.toLowerCase().includes(searchTerm)) ||
            (customer.phone && customer.phone.includes(searchTerm)) ||
            (customer.cpfCnpj && customer.cpfCnpj.includes(searchTerm))
        );
    });
    renderTable(filteredCustomers);
});

// --- LÓGICA DO MODAL DE CADASTRO ---
function openNewCustomerModal() { newCustomerModal.style.display = 'flex'; }
function closeNewCustomerModal() {
    newCustomerModal.style.display = 'none';
    newCustomerForm.reset();
    newCustomerStatus.textContent = '';
}

openNewCustomerModalBtn.addEventListener('click', openNewCustomerModal);
closeNewCustomerModalBtn.addEventListener('click', closeNewCustomerModal);
cancelNewCustomerBtn.addEventListener('click', closeNewCustomerModal);

newCustomerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newName').value.trim();
    if (!name) {
        newCustomerStatus.textContent = "O campo Nome é obrigatório!";
        newCustomerStatus.style.color = "red";
        return;
    }

    const customerData = {
        name,
        email: document.getElementById('newEmail').value.trim(),
        phone: document.getElementById('newPhone').value.trim(),
        cpfCnpj: document.getElementById('newCpfCnpj').value.trim(),
        address: document.getElementById('newAddress').value.trim(),
        obs: document.getElementById('newObs').value.trim(),
        ownerId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('customers').add(customerData);
        newCustomerStatus.textContent = "Cliente cadastrado com sucesso!";
        newCustomerStatus.style.color = "green";
        await loadCustomers();
        setTimeout(closeNewCustomerModal, 1500);
    } catch (error) {
        console.error("Erro ao cadastrar cliente: ", error);
        newCustomerStatus.textContent = "Falha ao cadastrar. Tente novamente.";
        newCustomerStatus.style.color = "red";
    }
});

// --- LÓGICA DE EDIÇÃO E EXCLUSÃO ---
customerTableBody.addEventListener('click', (e) => {
    const target = e.target;
    if (target.tagName !== 'BUTTON') return;

    const customerId = target.closest('tr').dataset.id;
    
    if (target.classList.contains('edit-btn')) {
        showEditView(customerId);
    }
    if (target.classList.contains('delete-btn')) {
        handleDelete(customerId);
    }
});

async function showEditView(customerId) {
    try {
        const doc = await db.collection('customers').doc(customerId).get();
        if (!doc.exists) return alert("Cliente não encontrado.");
        const customer = doc.data();

        document.getElementById('editCustomerId').value = customerId;
        document.getElementById('editName').value = customer.name;
        document.getElementById('editEmail').value = customer.email || '';
        document.getElementById('editPhone').value = customer.phone || '';
        document.getElementById('editCpfCnpj').value = customer.cpfCnpj || '';
        document.getElementById('editAddress').value = customer.address || '';
        document.getElementById('editObs').value = customer.obs || '';

        customerListContainer.style.display = 'none';
        editCustomerContainer.style.display = 'block';
    } catch (error) {
        console.error("Erro ao carregar dados para edição: ", error);
        alert("Não foi possível carregar os dados do cliente.");
    }
}

function hideEditView() {
    editCustomerContainer.style.display = 'none';
    customerListContainer.style.display = 'block';
    editCustomerForm.reset();
}
cancelEditBtn.addEventListener('click', hideEditView);

editCustomerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const customerId = document.getElementById('editCustomerId').value;
    const name = document.getElementById('editName').value.trim();
    if (!name) return alert("O nome é obrigatório.");

    const updatedData = {
        name,
        email: document.getElementById('editEmail').value.trim(),
        phone: document.getElementById('editPhone').value.trim(),
        cpfCnpj: document.getElementById('editCpfCnpj').value.trim(),
        address: document.getElementById('editAddress').value.trim(),
        obs: document.getElementById('editObs').value.trim()
    };

    try {
        await db.collection('customers').doc(customerId).update(updatedData);
        alert("Cliente atualizado com sucesso!");
        await loadCustomers();
        hideEditView();
    } catch (error) {
        console.error("Erro ao atualizar cliente: ", error);
        alert("Falha ao atualizar. Tente novamente.");
    }
});

async function handleDelete(customerId) {
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) return;

    if (confirm(`Tem certeza que deseja excluir o cliente "${customer.name}"?`)) {
        try {
            await db.collection('customers').doc(customerId).delete();
            alert("Cliente excluído com sucesso!");
            loadCustomers();
        } catch (error) {
            console.error("Erro ao excluir cliente: ", error);
            alert("Falha ao excluir. Tente novamente.");
        }
    }
}