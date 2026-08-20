function getCurrentUser() {
    const token = sessionStorage.getItem("access_token");
    const currentUserText = sessionStorage.getItem("current_user");

    if (!token || !currentUserText) {
        window.location.href = "/login.html";
        return null;
    }

    try {
        return JSON.parse(currentUserText);
    } catch (error) {
        console.error(error);
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("current_user");
        window.location.href = "/login.html";
        return null;
    }
}

function formatDateTime(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("ja-JP");
}

function renderCurrentUser(currentUser) {
    document.getElementById("current-user-name").textContent =
        currentUser.username;

    document.getElementById("current-user-role").textContent =
        currentUser.role;
}

function controlMenus(currentUser) {
    const approvalMenu = document.getElementById("approval-menu");
    const adminMenu = document.getElementById("admin-menu");

    if (
        currentUser.role === "approver" ||
        currentUser.role === "admin"
    ) {
        approvalMenu.hidden = false;
    }

    if (currentUser.role === "admin") {
        adminMenu.hidden = false;
    }
}

function renderRequests(requests) {
    const tbody = document.getElementById("requests-table-body");
    const emptyMessage = document.getElementById("empty-message");

    tbody.replaceChildren();

    if (requests.length === 0) {
        emptyMessage.hidden = false;
        return;
    }

    emptyMessage.hidden = true;

    for (const request of requests) {
        const row = document.createElement("tr");

        const idCell = document.createElement("td");
        idCell.textContent = request.id;

        const typeCell = document.createElement("td");
        typeCell.textContent = request.request_type;

        const titleCell = document.createElement("td");
        titleCell.textContent = request.title;

        const applicantCell = document.createElement("td");
        applicantCell.textContent = request.applicant_name;

        const statusCell = document.createElement("td");
        statusCell.textContent = request.status;

        const createdAtCell = document.createElement("td");
        createdAtCell.textContent = formatDateTime(request.created_at);

        const actionCell = document.createElement("td");
        const detailLink = document.createElement("a");

        detailLink.href = `/request-detail.html?id=${request.id}`;
        detailLink.textContent = "詳細";
        detailLink.className = "action-link";

        actionCell.appendChild(detailLink);

        row.appendChild(idCell);
        row.appendChild(typeCell);
        row.appendChild(titleCell);
        row.appendChild(applicantCell);
        row.appendChild(statusCell);
        row.appendChild(createdAtCell);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    }
}

async function loadRequests() {
    const errorMessage = document.getElementById("requests-error");

    errorMessage.textContent = "";

    try {
        const response = await apiRequest("/requests");

        if (!response.ok) {
            errorMessage.textContent =
                "申請一覧の取得に失敗しました。";
            return;
        }

        const requests = await response.json();
        renderRequests(requests);
    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error(error);
            errorMessage.textContent =
                "サーバーに接続できません。";
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = getCurrentUser();

    if (!currentUser) {
        return;
    }

    renderCurrentUser(currentUser);
    controlMenus(currentUser);

    document
        .getElementById("logout-button")
        .addEventListener("click", logout);

    await loadRequests();
});
