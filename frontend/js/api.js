async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});

    if (!headers.has("Content-Type") && options.body) {
        headers.set("Content-Type", "application/json");
    }

    const token = sessionStorage.getItem("access_token");

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`/api${path}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("current_user");
        window.location.href = "/login.html";
        throw new Error("Unauthorized");
    }

    return response;
}
