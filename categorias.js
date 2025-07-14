// categorias.js
document.addEventListener('DOMContentLoaded', () => {
    // A sua configuração do Firebase (deve ser a mesma do produtos.js)
    const firebaseConfig = {
      apiKey: "AIzaSyAg0DdzFPBnGyEe_aLhVIwU5Ksljd0jTkY",
      authDomain: "smart-point-pdv-ed911.firebaseapp.com",
      databaseURL: "https://smart-point-pdv-ed911-default-rtdb.firebaseio.com",
      projectId: "smart-point-pdv-ed911",
      storageBucket: "smart-point-pdv-ed911.appspot.com",
      messagingSenderId: "308482043681",
      appId: "1:308482043681:web:0505c90795b9151e7b9860"
    };

    // Inicializa o Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Elementos do DOM
    const categoryModal = document.getElementById('categoryModal');
    const categoryForm = document.getElementById('categoryForm');
    const modalTitle = document.getElementById('modalTitle');
    const categoryIdInput = document.getElementById('categoryId');
    const categoryNameInput = document.getElementById('categoryName');
    const categoryDescriptionInput = document.getElementById('categoryDescription');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const categoryListDiv = document.getElementById('categoryList');

    // --- Autenticação e Carregamento Inicial ---
    auth.onAuthStateChanged(user => {
        if (user) {
            loadCategories(user.uid);
        } else {
            // Redireciona para a página de login se o usuário não estiver autenticado
            window.location.href = '/login.html';
        }
    });

    // --- Funções do Modal ---
    function openCategoryModal(category = null) {
        categoryForm.reset();
        if (category) { // Editando
            modalTitle.textContent = 'Editar Categoria';
            categoryIdInput.value = category.id;
            categoryNameInput.value = category.name;
            categoryDescriptionInput.value = category.description || '';
        } else { // Adicionando
            modalTitle.textContent = 'Adicionar Nova Categoria';
            categoryIdInput.value = '';
        }
        categoryModal.style.display = 'block';
    }

    window.closeCategoryModal = function() {
        categoryModal.style.display = 'none';
    }

    // Event Listeners para abrir e fechar o modal
    addCategoryBtn.addEventListener('click', () => openCategoryModal());
    window.addEventListener('click', (event) => {
        if (event.target === categoryModal) {
            closeCategoryModal();
        }
    });

    // --- Lógica do Formulário (Salvar/Atualizar) ---
    categoryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            alert("Você não está logado.");
            return;
        }

        const categoryData = {
            name: categoryNameInput.value.trim(),
            description: categoryDescriptionInput.value.trim(),
            ownerId: user.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const currentCategoryId = categoryIdInput.value;

        try {
            if (currentCategoryId) {
                // Atualizar categoria existente
                await db.collection('categories').doc(currentCategoryId).update(categoryData);
                alert('Categoria atualizada com sucesso!');
            } else {
                // Criar nova categoria
                categoryData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('categories').add(categoryData);
                alert('Categoria adicionada com sucesso!');
            }
            closeCategoryModal();
            loadCategories(user.uid);
        } catch (error) {
            console.error('Erro ao salvar categoria:', error);
            alert('Erro ao salvar categoria: ' + error.message);
        }
    });

    // --- Carregar e Exibir Categorias ---
    async function loadCategories(userId) {
        categoryListDiv.innerHTML = '<p>Carregando categorias...</p>';

        try {
            const snapshot = await db.collection('categories')
                                     .where('ownerId', '==', userId)
                                     .orderBy('name', 'asc')
                                     .get();
            
            if (snapshot.empty) {
                categoryListDiv.innerHTML = '<p>Nenhuma categoria cadastrada. Clique em "Adicionar Categoria" para começar.</p>';
                return;
            }

            categoryListDiv.innerHTML = '';
            snapshot.forEach(doc => {
                const category = { id: doc.id, ...doc.data() };
                const card = document.createElement('div');
                card.className = 'category-card';
                card.innerHTML = `
                    <h4>${category.name}</h4>
                    <p class="category-description">${category.description || 'Sem descrição'}</p>
                    <div class="category-actions">
                        <button class="btn btn-edit" data-id="${category.id}">Editar</button>
                        <button class="btn btn-delete" data-id="${category.id}">Excluir</button>
                    </div>
                `;
                categoryListDiv.appendChild(card);
            });

            // Adicionar event listeners aos botões de editar e excluir
            attachActionListeners();

        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
            categoryListDiv.innerHTML = '<p>Ocorreu um erro ao carregar as categorias.</p>';
        }
    }

    function attachActionListeners() {
    // Botões de Editar
    document.querySelectorAll('.btn-edit').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const docRef = db.collection('categories').doc(id);
            const docSnap = await docRef.get();
            
            // CORREÇÃO APLICADA AQUI
            if (docSnap.exists) { 
                openCategoryModal({ id: docSnap.id, ...docSnap.data() });
            } else {
                alert("Categoria não encontrada.");
            }
        });
    });

    // Botões de Excluir
    document.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('Tem certeza que deseja excluir esta categoria? Isso pode afetar produtos já cadastrados.')) {
                try {
                    await db.collection('categories').doc(id).delete();
                    alert('Categoria excluída com sucesso!');
                    loadCategories(auth.currentUser.uid);
                } catch (error) {
                    console.error('Erro ao excluir categoria:', error);
                    alert('Erro ao excluir categoria.');
                }
            }
        });
    });
}
});