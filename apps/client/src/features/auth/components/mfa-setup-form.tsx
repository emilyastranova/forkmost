import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PinInput, Button, Container, Title, Box, Text, Group, Stack, Image, Loader, CopyButton, ActionIcon, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications"; // Remove IconCheck, IconCopy
import { setupGenerateMfaSecret, setupEnableMfa } from "@/features/auth/services/auth-service";
import APP_ROUTE from "@/lib/app-route";
import classes from "./auth.module.css";
import QRCode from "qrcode";

// Simple icons replacement if not available, or I should import from tabler icons if project uses them
// Looking at package.json, project doesn't list tabler icons explicitly but mantine usually includes them.
// I'll skip icons for now or use text.

export function MfaSetupForm() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [step, setStep] = useState<"loading" | "scan" | "verify">("loading");
    const [secret, setSecret] = useState("");
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [token, setToken] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const credentials = location.state;

    useEffect(() => {
        if (!credentials || !credentials.email || !credentials.password) {
            notifications.show({
                message: t("Session expired. Please login again."),
                color: "red",
            });
            navigate(APP_ROUTE.AUTH.LOGIN);
            return;
        }

        // Generate secret
        const init = async () => {
            try {
                const data = await setupGenerateMfaSecret({
                    email: credentials.email,
                    password: credentials.password,
                });
                setSecret(data.secret);
                // Generate QR code image
                const url = await QRCode.toDataURL(data.otpauthUrl);
                setQrCodeUrl(url);
                setStep("scan");
            } catch (err: any) {
                notifications.show({
                    message: err.response?.data?.message || t("Failed to generate MFA secret"),
                    color: "red",
                });
                navigate(APP_ROUTE.AUTH.LOGIN);
            }
        };

        init();
    }, [credentials, navigate, t]);

    const handleVerify = async () => {
        if (token.length !== 6) return;
        setIsLoading(true);

        try {
            await setupEnableMfa({
                email: credentials.email,
                password: credentials.password,
                secret,
                token
            });

            notifications.show({
                message: t("MFA enabled successfully. Please login."),
                color: "green",
            });

            // Redirect to login to force clean re-login with new MFA requirement (which will now hit challenge page)
            // Or I could navigate to HOME if enableMfa returned a token?
            // My setupEnableMfa returns true/false usually, let's check controller.
            // Controller returns result of mfaService.enableMfa which returns true.
            // So user is still NOT logged in with a token.
            navigate(APP_ROUTE.AUTH.LOGIN);

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
                    {t("Set up Two-Factor Authentication")}
                </Title>

                {step === "loading" && (
                    <Group justify="center" p="xl">
                        <Loader />
                    </Group>
                )}

                {step === "scan" && (
                    <Stack align="center" gap="md">
                        <Text size="sm" ta="center">
                            {t("Scan the QR code below with your authenticator app (e.g. Google Authenticator, Authy)")}
                        </Text>

                        {qrCodeUrl && <Image src={qrCodeUrl} w={200} h={200} />}

                        <Text size="xs" c="dimmed">
                            {t("Or enter this code manually:")}
                        </Text>
                        <Group gap="xs">
                            <Text fw={700} style={{ fontFamily: "monospace" }}>{secret}</Text>
                            <CopyButton value={secret}>
                                {({ copied, copy }) => (
                                    <Button color={copied ? 'teal' : 'blue'} onClick={copy} size="xs" variant="subtle">
                                        {copied ? 'Copied' : 'Copy'}
                                    </Button>
                                )}
                            </CopyButton>
                        </Group>

                        <Divider w="100%" my="sm" />

                        <Text size="sm" fw={500}>{t("Enter the 6-digit code to verify")}</Text>

                        <PinInput
                            length={6}
                            oneTimeCode
                            type="number"
                            value={token}
                            onChange={setToken}
                            size="lg"
                            onComplete={() => handleVerify()}
                        />

                        <Button
                            fullWidth
                            mt="md"
                            loading={isLoading}
                            onClick={handleVerify}
                            disabled={token.length !== 6}
                        >
                            {t("Enable & Login")}
                        </Button>
                    </Stack>
                )}

                <Group justify="center" mt="xl">
                    <Button variant="subtle" size="xs" onClick={() => navigate(APP_ROUTE.AUTH.LOGIN)}>
                        {t("Back to Login")}
                    </Button>
                </Group>
            </Box>
        </Container>
    );
}

import { Divider } from "@mantine/core";
