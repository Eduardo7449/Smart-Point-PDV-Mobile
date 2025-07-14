// Configuração do Firebase (mesma dos outros arquivos)
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
const vendorListContainer = document.getElementById('vendorListContainer');
const editVendorContainer = document.getElementById('editVendorContainer');
const vendorTableBody = document.getElementById('vendorTableBody');
const searchEntry = document.getElementById('searchEntry');

// Modal de Novo Vendedor
const newVendorModal = document.getElementById('newVendorModal');
const newVendorForm = document.getElementById('newVendorForm');
const openNewVendorModalBtn = document.getElementById('openNewVendorModalBtn');
const closeNewVendorModalBtn = document.getElementById('closeNewVendorModalBtn');
const cancelNewVendorBtn = document.getElementById('cancelNewVendorBtn');
const newVendorStatus = document.getElementById('newVendorStatus');

// Formulário de Edição
const editVendorForm = document.getElementById('editVendorForm');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// --- Estado Global ---
let currentUser = null;
let allVendors = []; // Cache local para a pesquisa

// --- INICIALIZAÇÃO E AUTENTICAÇÃO ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loadVendors();
    } else {
        window.location.href = '/login.html';
    }
});

// --- CARREGAMENTO E EXIBIÇÃO DOS DADOS ---
async function loadVendors() {
    try {
        const snapshot = await db.collection('vendors').where('ownerId', '==', currentUser.uid).get();
        allVendors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTable(allVendors);
    } catch (error) {
        console.error("Erro ao carregar vendedores: ", error);
        vendorTableBody.innerHTML = `<tr><td colspan="5">Erro ao carregar dados.</td></tr>`;
    }
}

function renderTable(vendors) {
    vendorTableBody.innerHTML = ''; // Limpa a tabela
    if (vendors.length === 0) {
        vendorTableBody.innerHTML = `<tr><td colspan="5">Nenhum vendedor cadastrado.</td></tr>`;
        return;
    }

    vendors.forEach(vendor => {
        const tr = document.createElement('tr');
        tr.dataset.id = vendor.id;

        // Formata a data
        let regDate = 'N/A';
        if (vendor.registration_date) {
            try {
                const dateParts = vendor.registration_date.split('-'); // Assume YYYY-MM-DD
                if (dateParts.length === 3) {
                    regDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                }
            } catch { /* Mantém N/A se a data for inválida */ }
        }

        tr.innerHTML = `
        <td data-label="Nome">${vendor.name}</td>
        <td data-label="Email">${vendor.email || 'N/A'}</td>
        <td data-label="Telefone">${vendor.phone || 'N/A'}</td>
        <td data-label="Data Cadastro">${regDate}</td>
        <td class="actions-cell">
            <button class="btn btn-primary edit-btn">Editar</button>
            <button class="btn btn-danger delete-btn">Apagar</button>
        </td>
    `;
    vendorTableBody.appendChild(tr);
    });
}

// --- PESQUISA (FILTRO) ---
searchEntry.addEventListener('keyup', () => {
    const searchTerm = searchEntry.value.toLowerCase();
    const filteredVendors = allVendors.filter(vendor => {
        return (
            vendor.name.toLowerCase().includes(searchTerm) ||
            (vendor.email && vendor.email.toLowerCase().includes(searchTerm)) ||
            (vendor.phone && vendor.phone.includes(searchTerm))
        );
    });
    renderTable(filteredVendors);
});


// --- LÓGICA DO MODAL DE CADASTRO (VendorRegistrationWindow) ---
function openNewVendorModal() { newVendorModal.style.display = 'flex'; }
function closeNewVendorModal() {
    newVendorModal.style.display = 'none';
    newVendorForm.reset();
    newVendorStatus.textContent = '';
}

openNewVendorModalBtn.addEventListener('click', openNewVendorModal);
closeNewVendorModalBtn.addEventListener('click', closeNewVendorModal);
cancelNewVendorBtn.addEventListener('click', closeNewVendorModal);

newVendorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newName').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const phone = document.getElementById('newPhone').value.trim();

    if (!name) {
        newVendorStatus.textContent = "O campo Nome é obrigatório!";
        newVendorStatus.style.color = "#ef476f";
        return;
    }

    const vendorData = {
        name, email, phone,
        ownerId: currentUser.uid,
        registration_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
    };

    try {
        await db.collection('vendors').add(vendorData);
        newVendorStatus.textContent = "Vendedor cadastrado com sucesso!";
        newVendorStatus.style.color = "#06d6a0";
        await loadVendors();
        setTimeout(closeNewVendorModal, 1500); // Fecha após sucesso
    } catch (error) {
        console.error("Erro ao cadastrar vendedor: ", error);
        newVendorStatus.textContent = "Falha ao cadastrar. Tente novamente.";
        newVendorStatus.style.color = "#ef476f";
    }
});

// --- LÓGICA DE EDIÇÃO E EXCLUSÃO (VendorManagementPanel) ---

// Event Delegation para botões de ação na tabela
vendorTableBody.addEventListener('click', (e) => {
    const target = e.target;
    const vendorId = target.closest('tr').dataset.id;
    
    if (target.classList.contains('edit-btn')) {
        showEditView(vendorId);
    }
    if (target.classList.contains('delete-btn')) {
        handleDelete(vendorId);
    }
});

// Exibe formulário de edição
async function showEditView(vendorId) {
    try {
        const doc = await db.collection('vendors').doc(vendorId).get();
        if (!doc.exists) {
            alert("Vendedor não encontrado.");
            return;
        }
        const vendor = doc.data();

        document.getElementById('editVendorId').value = vendorId;
        document.getElementById('editName').value = vendor.name;
        document.getElementById('editEmail').value = vendor.email || '';
        document.getElementById('editPhone').value = vendor.phone || '';

        vendorListContainer.style.display = 'none';
        editVendorContainer.style.display = 'block';
    } catch (error) {
        console.error("Erro ao carregar dados para edição: ", error);
        alert("Não foi possível carregar os dados do vendedor.");
    }
}

// Esconde formulário de edição
function hideEditView() {
    editVendorContainer.style.display = 'none';
    vendorListContainer.style.display = 'block';
    editVendorForm.reset();
}
cancelEditBtn.addEventListener('click', hideEditView);

// Submete o formulário de edição
editVendorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const vendorId = document.getElementById('editVendorId').value;
    const name = document.getElementById('editName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();

    if (!name) {
        alert("O nome é obrigatório.");
        return;
    }

    const updatedData = { name, email, phone };

    try {
        await db.collection('vendors').doc(vendorId).update(updatedData);
        alert("Vendedor atualizado com sucesso!");
        await loadVendors();
        hideEditView();
    } catch (error) {
        console.error("Erro ao atualizar vendedor: ", error);
        alert("Falha ao atualizar. Tente novamente.");
    }
});

// Exclui um vendedor
async function handleDelete(vendorId) {
    const vendor = allVendors.find(v => v.id === vendorId);
    if (!vendor) return;

    if (confirm(`Tem certeza que deseja excluir o vendedor "${vendor.name}"?\nEsta ação não pode ser desfeita.`)) {
        try {
            await db.collection('vendors').doc(vendorId).delete();
            alert("Vendedor excluído com sucesso!");
            loadVendors();
        } catch (error) {
            console.error("Erro ao excluir vendedor: ", error);
            alert("Falha ao excluir. Tente novamente.");
        }
    }
}