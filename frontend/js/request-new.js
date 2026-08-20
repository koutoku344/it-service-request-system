function getCurrentUserForRequestPage() {
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

function setupRequestPage(currentUser) {
    document.getElementById("current-user-name").textContent =
        currentUser.username;
    document.getElementById("current-user-role").textContent =
        currentUser.role;

    if (currentUser.role === "approver" || currentUser.role === "admin") {
        document.getElementById("approval-menu").hidden = false;
    }

    if (currentUser.role === "admin") {
        document.getElementById("admin-menu").hidden = false;
    }
}

async function loadRequestTypes() {
    const response = await apiRequest("/request-types");

    if (!response.ok) {
        throw new Error("申請種別の取得に失敗しました。");
    }

    const requestTypes = await response.json();
    const select = document.getElementById("request-type");

    for (const requestType of requestTypes) {
        const option = document.createElement("option");
        option.value = requestType.code;
        option.textContent = requestType.name;
        select.appendChild(option);
    }
}

async function createRequest(event) {
    event.preventDefault();

    const errorMessage = document.getElementById("request-error");
    errorMessage.textContent = "";

    const requestType = document.getElementById("request-type").value;
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();

    try {
        const response = await apiRequest("/requests", {
            method: "POST",
            body: JSON.stringify({
                request_type: requestType,
                title: title,
                description: description
            })
        });

        if (!response.ok) {
            errorMessage.textContent = "申請の登録に失敗しました。";
            return;
        }

        window.location.href = "/requests.html";
    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error(error);
            errorMessage.textContent = "申請の登録に失敗しました。";
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = getCurrentUserForRequestPage();

    if (!currentUser) {
        return;
    }

    setupRequestPage(currentUser);

    document.getElementById("logout-button")
        .addEventListener("click", logout);

    document.getElementById("request-form")
        .addEventListener("submit", createRequest);

    try {
        await loadRequestTypes();
    } catch (error) {
        if (error.message !== "Unauthorized") {
            document.getElementById("request-error").textContent =
                "申請種別の取得に失敗しました。";
        }
    }
});
