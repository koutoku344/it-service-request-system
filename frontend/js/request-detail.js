function getDetailPageCurrentUser() {
    const token = sessionStorage.getItem("access_token");
    const currentUserText = sessionStorage.getItem("current_user");

    if (!token || !currentUserText) {
        window.location.href = "/login.html";
        return null;
    }

    try {
        return JSON.parse(currentUserText);
    } catch (error) {
        sessionStorage.clear();
        window.location.href = "/login.html";
        return null;
    }
}

function getRequestIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

function formatDetailDateTime(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("ja-JP");
}

function setupDetailPageUser(currentUser) {
    document.getElementById("current-user-name").textContent =
        currentUser.username;

    document.getElementById("current-user-role").textContent =
        currentUser.role;

    if (
        currentUser.role === "approver" ||
        currentUser.role === "admin"
    ) {
        document.getElementById("approval-menu").hidden = false;
    }

    if (currentUser.role === "admin") {
        document.getElementById("admin-menu").hidden = false;
    }
}

function renderRequestDetail(request) {
    document.getElementById("request-id").textContent = request.id;
    document.getElementById("request-type").textContent = request.request_type;
    document.getElementById("request-title").textContent = request.title;
    document.getElementById("request-description").textContent = request.description;
    document.getElementById("request-applicant").textContent = request.applicant_name;
    document.getElementById("request-status").textContent = request.status;
    document.getElementById("request-created-at").textContent =
        formatDetailDateTime(request.created_at);
    document.getElementById("request-updated-at").textContent =
        formatDetailDateTime(request.updated_at);

    document.getElementById("history-request-id").textContent = request.id;
}

function renderApprovalHistory(histories) {
    const tbody = document.getElementById("approval-history-body");
    const emptyMessage = document.getElementById("history-empty");

    tbody.replaceChildren();

    if (histories.length === 0) {
        emptyMessage.hidden = false;
        return;
    }

    emptyMessage.hidden = true;

    for (const history of histories) {
        const row = document.createElement("tr");

        const actionCell = document.createElement("td");
        actionCell.textContent = history.action;

        const commentCell = document.createElement("td");
        commentCell.textContent = history.comment || "";

        const approverCell = document.createElement("td");
        approverCell.textContent = history.approver_name;

        const createdAtCell = document.createElement("td");
        createdAtCell.textContent =
            formatDetailDateTime(history.created_at);

        row.appendChild(actionCell);
        row.appendChild(commentCell);
        row.appendChild(approverCell);
        row.appendChild(createdAtCell);

        tbody.appendChild(row);
    }
}

async function loadRequestDetail(requestId) {
    const response = await apiRequest(`/requests/${requestId}`);

    if (response.status === 404) {
        throw new Error("RequestNotFound");
    }

    if (!response.ok) {
        throw new Error("DetailLoadFailed");
    }

    renderRequestDetail(await response.json());
}

async function loadApprovalHistory(requestId) {
    const response = await apiRequest(
        `/requests/${requestId}/approval-history`
    );

    if (response.status === 404) {
        throw new Error("RequestNotFound");
    }

    if (!response.ok) {
        throw new Error("HistoryLoadFailed");
    }

    renderApprovalHistory(await response.json());
}

async function cancelRequest(requestId) {
    const errorMessage = document.getElementById("detail-error");
    errorMessage.textContent = "";

    try {
        const response = await apiRequest(
            `/requests/${requestId}/cancel`,
            {
                method: "PATCH"
            }
        );

        if (response.ok) {
            window.location.reload();
            return;
        }

        if (response.status === 403) {
            errorMessage.textContent =
                "この申請を取り消す権限がありません。";
            return;
        }

        if (response.status === 404) {
            errorMessage.textContent =
                "対象の申請が存在しません。";
            return;
        }

        if (response.status === 409) {
            errorMessage.textContent =
                "この申請は現在の状態では取り消せません。";
            return;
        }

        errorMessage.textContent =
            "申請の取消に失敗しました。";
    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error(error);
            errorMessage.textContent =
                "申請の取消に失敗しました。";
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = getDetailPageCurrentUser();

    if (!currentUser) {
        return;
    }

    const requestId = getRequestIdFromUrl();

    if (!requestId) {
        document.getElementById("detail-error").textContent =
            "申請IDが指定されていません。";
        return;
    }

    setupDetailPageUser(currentUser);

    document.getElementById("logout-button")
        .addEventListener("click", logout);

    document.getElementById("cancel-request-button")
        .addEventListener(
            "click",
            () => cancelRequest(requestId)
        );

    try {
        await loadRequestDetail(requestId);
        await loadApprovalHistory(requestId);
    } catch (error) {
        if (error.message === "Unauthorized") {
            return;
        }

        if (error.message === "RequestNotFound") {
            document.getElementById("detail-error").textContent =
                "対象の申請が存在しません。";
            return;
        }

        console.error(error);
        document.getElementById("detail-error").textContent =
            "申請情報の取得に失敗しました。";
    }
});
