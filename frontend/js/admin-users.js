function getAdminCurrentUser() {
    const token = sessionStorage.getItem("access_token");
    const text = sessionStorage.getItem("current_user");

    if (!token || !text) {
        window.location.href = "/login.html";
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        sessionStorage.clear();
        window.location.href = "/login.html";
        return null;
    }
}

function setupAdminPage(currentUser) {
    document.getElementById("current-user-name").textContent =
        currentUser.username;

    document.getElementById("current-user-role").textContent =
        currentUser.role;

    if (currentUser.role !== "admin") {
        window.location.href = "/requests.html";
        return false;
    }

    return true;
}

function showUserAdminMessage(type, message) {
    const errorElement =
        document.getElementById("user-admin-error");

    const successElement =
        document.getElementById("user-admin-success");

    errorElement.textContent = "";
    successElement.textContent = "";

    if (type === "error") {
        errorElement.textContent = message;
    } else {
        successElement.textContent = message;
    }
}

async function loadUsers() {
    const response = await apiRequest("/admin/users");

    if (!response.ok) {
        throw new Error("UserListLoadFailed");
    }

    const users = await response.json();
    const tbody = document.getElementById("users-table-body");

    tbody.replaceChildren();

    for (const user of users) {
        const row = document.createElement("tr");

        const idCell = document.createElement("td");
        idCell.textContent = user.id;

        const usernameCell = document.createElement("td");
        usernameCell.textContent = user.username;

        const roleCell = document.createElement("td");
        const roleSelect = document.createElement("select");

        for (const role of ["user", "approver", "admin"]) {
            const option = document.createElement("option");
            option.value = role;
            option.textContent = role;
            option.selected = user.role === role;
            roleSelect.appendChild(option);
        }

        roleCell.appendChild(roleSelect);

        const activeCell = document.createElement("td");
        activeCell.textContent =
            user.is_active ? "有効" : "無効";

        const actionCell = document.createElement("td");

        const roleButton = document.createElement("button");
        roleButton.type = "button";
        roleButton.textContent = "ロール変更";

        roleButton.addEventListener(
            "click",
            () => changeUserRole(
                user.id,
                roleSelect.value
            )
        );

        const activeButton = document.createElement("button");
        activeButton.type = "button";
        activeButton.textContent =
            user.is_active ? "無効化" : "有効化";

        activeButton.addEventListener(
            "click",
            () => changeUserActive(
                user.id,
                !user.is_active
            )
        );

        actionCell.appendChild(roleButton);
        actionCell.appendChild(activeButton);

        row.appendChild(idCell);
        row.appendChild(usernameCell);
        row.appendChild(roleCell);
        row.appendChild(activeCell);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    }
}

async function createUser(event) {
    event.preventDefault();

    const username =
        document.getElementById("new-username").value.trim();

    const password =
        document.getElementById("new-password").value;

    const role =
        document.getElementById("new-role").value;

    const response = await apiRequest(
        "/admin/users",
        {
            method: "POST",
            body: JSON.stringify({
                username,
                password,
                role
            })
        }
    );

    if (response.ok) {
        showUserAdminMessage(
            "success",
            "ユーザーを登録しました。"
        );

        event.target.reset();
        await loadUsers();
        return;
    }

    if (response.status === 409) {
        showUserAdminMessage(
            "error",
            "同じユーザー名が既に存在します。"
        );
        return;
    }

    if (response.status === 422) {
        showUserAdminMessage(
            "error",
            "入力内容を確認してください。"
        );
        return;
    }

    showUserAdminMessage(
        "error",
        "ユーザー登録に失敗しました。"
    );
}

async function changeUserRole(userId, role) {
    const response = await apiRequest(
        `/admin/users/${userId}/role`,
        {
            method: "PATCH",
            body: JSON.stringify({
                role
            })
        }
    );

    if (response.ok) {
        showUserAdminMessage(
            "success",
            "ロールを変更しました。"
        );

        await loadUsers();
        return;
    }

    showUserAdminMessage(
        "error",
        "ロール変更に失敗しました。"
    );
}

async function changeUserActive(userId, isActive) {
    const response = await apiRequest(
        `/admin/users/${userId}/active`,
        {
            method: "PATCH",
            body: JSON.stringify({
                is_active: isActive
            })
        }
    );

    if (response.ok) {
        showUserAdminMessage(
            "success",
            "有効状態を変更しました。"
        );

        await loadUsers();
        return;
    }

    if (response.status === 409) {
        showUserAdminMessage(
            "error",
            "自分自身を無効化することはできません。"
        );
        return;
    }

    showUserAdminMessage(
        "error",
        "有効状態の変更に失敗しました。"
    );
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        const currentUser = getAdminCurrentUser();

        if (!currentUser) {
            return;
        }

        if (!setupAdminPage(currentUser)) {
            return;
        }

        document
            .getElementById("logout-button")
            .addEventListener("click", logout);

        document
            .getElementById("user-create-form")
            .addEventListener("submit", createUser);

        try {
            await loadUsers();
        } catch (error) {
            if (error.message !== "Unauthorized") {
                console.error(error);

                showUserAdminMessage(
                    "error",
                    "ユーザー一覧の取得に失敗しました。"
                );
            }
        }
    }
);
