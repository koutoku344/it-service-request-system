function getRequestTypeAdminUser() {
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

function setupRequestTypeAdminPage(currentUser) {
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

function showRequestTypeMessage(type, message) {
    const errorElement =
        document.getElementById("request-type-error");

    const successElement =
        document.getElementById("request-type-success");

    errorElement.textContent = "";
    successElement.textContent = "";

    if (type === "error") {
        errorElement.textContent = message;
    } else {
        successElement.textContent = message;
    }
}

async function loadAdminRequestTypes() {
    const response = await apiRequest(
        "/admin/masters/request-types"
    );

    if (!response.ok) {
        throw new Error("RequestTypeListLoadFailed");
    }

    const requestTypes = await response.json();

    const tbody =
        document.getElementById(
            "request-types-table-body"
        );

    tbody.replaceChildren();

    for (const requestType of requestTypes) {
        const row = document.createElement("tr");

        const idCell = document.createElement("td");
        idCell.textContent = requestType.id;

        const codeCell = document.createElement("td");
        codeCell.textContent = requestType.code;

        const nameCell = document.createElement("td");
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = requestType.name;
        nameCell.appendChild(nameInput);

        const activeCell = document.createElement("td");
        const activeSelect = document.createElement("select");

        const activeOption = document.createElement("option");
        activeOption.value = "true";
        activeOption.textContent = "有効";

        const inactiveOption = document.createElement("option");
        inactiveOption.value = "false";
        inactiveOption.textContent = "無効";

        activeSelect.appendChild(activeOption);
        activeSelect.appendChild(inactiveOption);

        activeSelect.value =
            requestType.is_active ? "true" : "false";

        activeCell.appendChild(activeSelect);

        const actionCell = document.createElement("td");
        const updateButton = document.createElement("button");

        updateButton.type = "button";
        updateButton.textContent = "更新";

        updateButton.addEventListener(
            "click",
            () => updateRequestType(
                requestType.code,
                nameInput.value.trim(),
                activeSelect.value === "true"
            )
        );

        actionCell.appendChild(updateButton);

        row.appendChild(idCell);
        row.appendChild(codeCell);
        row.appendChild(nameCell);
        row.appendChild(activeCell);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    }
}

async function createRequestType(event) {
    event.preventDefault();

    const code =
        document.getElementById("new-code").value.trim();

    const name =
        document.getElementById("new-name").value.trim();

    const response = await apiRequest(
        "/admin/masters/request-types",
        {
            method: "POST",
            body: JSON.stringify({
                code,
                name
            })
        }
    );

    if (response.ok) {
        showRequestTypeMessage(
            "success",
            "申請種別を登録しました。"
        );

        event.target.reset();
        await loadAdminRequestTypes();
        return;
    }

    if (response.status === 409) {
        showRequestTypeMessage(
            "error",
            "同じコードが既に存在します。"
        );
        return;
    }

    if (response.status === 422) {
        showRequestTypeMessage(
            "error",
            "入力内容を確認してください。"
        );
        return;
    }

    showRequestTypeMessage(
        "error",
        "申請種別の登録に失敗しました。"
    );
}

async function updateRequestType(
    code,
    name,
    isActive
) {
    const response = await apiRequest(
        `/admin/masters/request-types/${code}`,
        {
            method: "PATCH",
            body: JSON.stringify({
                name,
                is_active: isActive
            })
        }
    );

    if (response.ok) {
        showRequestTypeMessage(
            "success",
            "申請種別を更新しました。"
        );

        await loadAdminRequestTypes();
        return;
    }

    if (response.status === 404) {
        showRequestTypeMessage(
            "error",
            "対象の申請種別が存在しません。"
        );
        return;
    }

    if (response.status === 422) {
        showRequestTypeMessage(
            "error",
            "入力内容を確認してください。"
        );
        return;
    }

    showRequestTypeMessage(
        "error",
        "申請種別の更新に失敗しました。"
    );
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        const currentUser = getRequestTypeAdminUser();

        if (!currentUser) {
            return;
        }

        if (!setupRequestTypeAdminPage(currentUser)) {
            return;
        }

        document
            .getElementById("logout-button")
            .addEventListener("click", logout);

        document
            .getElementById(
                "request-type-create-form"
            )
            .addEventListener(
                "submit",
                createRequestType
            );

        try {
            await loadAdminRequestTypes();
        } catch (error) {
            if (error.message !== "Unauthorized") {
                console.error(error);

                showRequestTypeMessage(
                    "error",
                    "申請種別一覧の取得に失敗しました。"
                );
            }
        }
    }
);
