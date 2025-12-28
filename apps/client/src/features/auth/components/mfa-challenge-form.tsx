import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PinInput, Button, Container, Title, Box, Text, Group, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { verifyMfa } from "@/features/auth/services/auth-service";
import APP_ROUTE from "@/lib/app-route";
import classes from "./auth.module.css";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";

export function MfaChallengeForm() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [token, setToken] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [, setCurrentUser] = useAtom(currentUserAtom);

    const credentials = location.state;

    useEffect(() => {
        if (!credentials || !credentials.email || !credentials.password) {
            notification: notifications.show({
                message: t("Session expired. Please login again."),
                color: "red",
            });
            navigate(APP_ROUTE.AUTH.LOGIN);
        }
    }, [credentials, navigate, t]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (token.length !== 6) return;

        setIsLoading(true);
        try {
            const response = await verifyMfa({
                email: credentials.email,
                password: credentials.password,
                token,
            });

            // Assuming verifyMfa sets cookie, we might need to fetch user or just redirect home
            // But verifyMfa returns { authToken }, and usually we need to set user state?
            // useAuth.signIn doesn't set user state explicitly, it relies on global app loader or redirect.
            // But let's assume redirecting to home triggers user fetch if needed.
            // Actually, after login we usually redirect to HOME which fetches user.

            notifications.show({
                message: t("Logged in successfully"),
                color: "green",
            });
            navigate(APP_ROUTE.HOME);
        } catch (err: any) {
            notifications.show({
                message: err.response?.data?.message || t("Invalid code"),
                color: "red",
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!credentials) return null;

    return (
        <Container size={420} className={classes.container}>
            <Box p="xl" className={classes.containerBox}>
                <Title order={2} ta="center" fw={500} mb="md">
                    {t("Two-Factor Authentication")}
                </Title>
                <Text c="dimmed" size="sm" ta="center" mb="lg">
                    {t("Enter the 6-digit code from your authenticator app")}
                </Text>

                <form onSubmit={handleSubmit}>
                    <Stack align="center" gap="md">
                        <PinInput
                            length={6}
                            oneTimeCode
                            type="number"
                            value={token}
                            onChange={setToken}
                            autoFocus
                            size="lg"
                            onComplete={() => handleSubmit()}
                        />

                        <Button
                            type="submit"
                            fullWidth
                            mt="md"
                            loading={isLoading}
                            disabled={token.length !== 6}
                        >
                            {t("Verify")}
                        </Button>
                    </Stack>
                </form>

                <Group justify="center" mt="xl">
                    <Button variant="subtle" size="xs" onClick={() => navigate(APP_ROUTE.AUTH.LOGIN)}>
                        {t("Back to Login")}
                    </Button>
                </Group>
            </Box>
        </Container>
    );
}
