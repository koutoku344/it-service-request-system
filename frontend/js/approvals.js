function getApprovalPageCurrentUser() {
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

function formatApprovalDateTime(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("ja-JP");
}

function setupApprovalPage(currentUser) {
    document.getElementById("current-user-name").textContent =
        currentUser.username;

    document.getElementById("current-user-role").textContent =
        currentUser.role;

    if (
        currentUser.role !== "approver" &&
        currentUser.role !== "admin"
    ) {
        window.location.href = "/requests.html";
        return false;
    }

    if (currentUser.role === "admin") {
        document.getElementById("admin-menu").hidden = false;
    }

    return true;
}

function createTextCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "";
    return cell;
}

function renderApprovalRequests(requests) {
    const tbody =
        document.getElementById("approval-table-body");

    const emptyMessage =
        document.getElementById("approval-empty");

    tbody.replaceChildren();

    const pendingRequests =
        requests.filter(
            request => request.status === "pending"
        );

    if (pendingRequests.length === 0) {
        emptyMessage.hidden = false;
        return;
    }

    emptyMessage.hidden = true;

    for (const request of pendingRequests) {
        const row = document.createElement("tr");

        row.appendChild(createTextCell(request.id));
        row.appendChild(createTextCell(request.request_type));
        row.appendChild(createTextCell(request.title));
        row.appendChild(createTextCell(request.applicant_name));
        row.appendChild(createTextCell(request.status));
        row.appendChild(
            createTextCell(
                formatApprovalDateTime(request.created_at)
            )
        );

        const commentCell = document.createElement("td");
        const commentInput = document.createElement("textarea");

        commentInput.rows = 3;
        commentInput.className = "approval-comment";
        commentInput.id = `comment-${request.id}`;
        commentInput.placeholder = "コメント";

        commentCell.appendChild(commentInput);
        row.appendChild(commentCell);

        const actionCell = document.createElement("td");
        actionCell.className = "approval-actions";

        const detailLink = document.createElement("a");
        detailLink.href =
            `/request-detail.html?id=${request.id}`;
        detailLink.textContent = "詳細";

        const approveButton =
            document.createElement("button");

        approveButton.type = "button";
        approveButton.textContent = "承認";

        approveButton.addEventListener(
            "click",
            () => processApproval(
                request.id,
                "approve"
            )
        );

        const rejectButton =
            document.createElement("button");

        rejectButton.type = "button";
        rejectButton.textContent = "却下";

        rejectButton.addEventListener(
            "click",
            () => processApproval(
                request.id,
                "reject"
            )
        );

        actionCell.appendChild(detailLink);
        actionCell.appendChild(approveButton);
        actionCell.appendChild(rejectButton);

        row.appendChild(actionCell);
        tbody.appendChild(row);
    }
}

async function loadApprovalRequests() {
    const response = await apiRequest("/requests");

    if (!response.ok) {
        throw new Error("ApprovalListLoadFailed");
    }

    const requests = await response.json();

    renderApprovalRequests(requests);
}

async function processApproval(requestId, action) {
    const errorMessage =
        document.getElementById("approval-error");

    const successMessage =
        document.getElementById("approval-success");

    errorMessage.textContent = "";
    successMessage.textContent = "";

    const comment =
        document
            .getElementById(`comment-${requestId}`)
            .value
            .trim();

    try {
        const response = await apiRequest(
            `/requests/${requestId}/${action}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    comment: comment
                })
            }
        );

        if (response.ok) {
            successMessage.textContent =
                action === "approve"
                    ? `申請ID ${requestId} を承認しました。`
                    : `申請ID ${requestId} を却下しました。`;

            await loadApprovalRequests();
            return;
        }

        if (response.status === 403) {
            errorMessage.textContent =
                "この操作を実行する権限がありません。";
            return;
        }

        if (response.status === 404) {
            errorMessage.textContent =
                "対象の申請が存在しません。";
            return;
        }

        if (response.status === 409) {
            errorMessage.textContent =
                "この申請は現在の状態では処理できません。";

            await loadApprovalRequests();
            return;
        }

        if (response.status === 422) {
            errorMessage.textContent =
                "入力内容を確認してください。";
            return;
        }

        errorMessage.textContent =
            "承認処理に失敗しました。";

    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error(error);

            errorMessage.textContent =
                "承認処理に失敗しました。";
        }
    }
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        const currentUser =
            getApprovalPageCurrentUser();

        if (!currentUser) {
            return;
        }

        if (!setupApprovalPage(currentUser)) {
            return;
        }

        document
            .getElementById("logout-button")
            .addEventListener("click", logout);

        try {
            await loadApprovalRequests();
        } catch (error) {
            if (error.message !== "Unauthorized") {
                console.error(error);

                document.getElementById(
                    "approval-error"
                ).textContent =
                    "承認対象の取得に失敗しました。";
            }
        }
    }
);
