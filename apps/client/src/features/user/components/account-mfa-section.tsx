import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Text, Group, Box, Title, Stack, Modal, Loader, Image, PinInput, CopyButton, Divider } from "@mantine/core";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { generateMfaSecret, enableMfa, disableMfa } from "@/features/auth/services/auth-service";
import { notifications } from "@mantine/notifications";
import QRCode from "qrcode";

export function AccountMfaSection() {
  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<"loading" | "scan" | "verify">("loading");
  const [secret, setSecret] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isMfaEnabled = user?.mfa?.isEnabled;

  const handleOpenSetup = async () => {
    setIsModalOpen(true);
    setStep("loading");
    setToken("");

    try {
      const data = await generateMfaSecret();
      setSecret(data.secret);
      const url = await QRCode.toDataURL(data.otpauthUrl);
      setQrCodeUrl(url);
      setStep("scan");
    } catch (err: any) {
      notifications.show({
        message: err.response?.data?.message || t("Failed to generate MFA secret"),
        color: "red",
      });
      setIsModalOpen(false);
    }
  };

  const handleEnable = async () => {
    if (token.length !== 6) return;
    setIsLoading(true);

    try {
      await enableMfa({ secret, token });
      notifications.show({
        message: t("Two-factor authentication enabled successfully"),
        color: "green",
      });
      setIsModalOpen(false);

      // Update local user state
      if (user) {
        setUser({
          ...user,
          mfa: { isEnabled: true }
        });
      }
    } catch (err: any) {
      notifications.show({
        message: err.response?.data?.message || t("Invalid code"),
        color: "red",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    // Confirm dialog could be added here
    if (!confirm(t("Are you sure you want to disable two-factor authentication?"))) return;

    try {
      await disableMfa();
      notifications.show({
        message: t("Two-factor authentication disabled"),
        color: "blue",
      });
      // Update local user state
      if (user) {
        setUser({
          ...user,
          mfa: { isEnabled: false }
        });
      }
    } catch (err: any) {
      notifications.show({
        message: err.response?.data?.message || t("Failed to disable MFA"),
        color: "red",
      });
    }
  };

  return (
    <Box>
      <Title order={4} mb="sm">{t("Two-Factor Authentication")}</Title>

      <Group justify="space-between" align="center">
        <Box>
          <Text fw={500}>
            {t("Status")}: <span style={{ color: isMfaEnabled ? "green" : "red" }}>
              {isMfaEnabled ? t("Enabled") : t("Disabled")}
            </span>
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            {t("Secure your account with two-factor authentication.")}
          </Text>
        </Box>

        {isMfaEnabled ? (
          <Button color="red" variant="light" onClick={handleDisable}>
            {t("Disable MFA")}
          </Button>
        ) : (
          <Button onClick={handleOpenSetup}>
            {t("Enable MFA")}
          </Button>
        )}
      </Group>

      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("Set up Two-Factor Authentication")}
        size="md"
      >
        {step === "loading" && (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        )}

        {step === "scan" && (
          <Stack align="center" gap="md">
            <Text size="sm" ta="center">
              {t("Scan the QR code below with your authenticator app")}
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
              onComplete={() => handleEnable()}
            />

            <Button
              fullWidth
              mt="md"
              loading={isLoading}
              onClick={handleEnable}
              disabled={token.length !== 6}
            >
              {t("Enable MFA")}
            </Button>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
