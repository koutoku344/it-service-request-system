const loginForm = document.getElementById("login-form");
const errorMessage = document.getElementById("error-message");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        errorMessage.textContent = "";

        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        try {
            const loginResponse = await apiRequest("/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    username,
                    password,
                }),
            });

            if (!loginResponse.ok) {
                if (loginResponse.status === 401) {
                    errorMessage.textContent =
                        "ユーザー名またはパスワードが正しくありません。";
                    return;
                }

                errorMessage.textContent =
                    "ログイン処理でエラーが発生しました。";
                return;
            }

            const loginData = await loginResponse.json();

            sessionStorage.setItem(
                "access_token",
                loginData.access_token
            );

            const meResponse = await apiRequest("/auth/me");

            if (!meResponse.ok) {
                sessionStorage.removeItem("access_token");
                errorMessage.textContent =
                    "ユーザー情報の取得に失敗しました。";
                return;
            }

            const currentUser = await meResponse.json();

            sessionStorage.setItem(
                "current_user",
                JSON.stringify(currentUser)
            );

            window.location.href = "/requests.html";
        } catch (error) {
            console.error(error);
            errorMessage.textContent =
                "サーバーに接続できません。";
        }
    });
}
