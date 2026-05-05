import { Button, Input, Text, View, signal } from "@jue/jsx";

const email = signal("demo@jue.dev");
const password = signal("letmein");
const loading = signal(false);
const headline = signal("Sign in to continue");
const supportText = signal("Use the mocked credentials below. The API is local-only and delayed on purpose.");
const statusClass = signal("my-demo-status my-demo-status--idle");
const statusText = signal("Ready");
const welcomeCardClass = signal("my-demo-result my-demo-result--idle");
const welcomeTitle = signal("No session yet");
const welcomeBody = signal("Submit the form to simulate a login request.");
const buttonLabel = signal("Sign in");

function handleEmailInput(event: { value?: unknown }) {
  email.set(String(event.value ?? ""));
  resetFeedback();
}

function handlePasswordInput(event: { value?: unknown }) {
  password.set(String(event.value ?? ""));
  resetFeedback();
}

function handleSubmit() {
  if (loading.get()) {
    return;
  }

  loading.set(true);
  buttonLabel.set("Signing in...");
  statusClass.set("my-demo-status my-demo-status--pending");
  statusText.set("Contacting mock auth service...");
  welcomeCardClass.set("my-demo-result my-demo-result--idle");
  welcomeTitle.set("Checking credentials");
  welcomeBody.set("This request is mocked with a short timeout.");

  void mockLogin(email.get(), password.get())
    .then((session) => {
      loading.set(false);
      buttonLabel.set("Signed in");
      statusClass.set("my-demo-status my-demo-status--success");
      statusText.set("Authenticated");
      welcomeCardClass.set("my-demo-result my-demo-result--success");
      welcomeTitle.set(`Welcome, ${session.name}`);
      welcomeBody.set(`Role: ${session.role}. Session source: ${session.source}.`);
    })
    .catch((errorValue: unknown) => {
      loading.set(false);
      buttonLabel.set("Try again");
      statusClass.set("my-demo-status my-demo-status--error");
      statusText.set(errorValue instanceof Error ? errorValue.message : String(errorValue));
      welcomeCardClass.set("my-demo-result my-demo-result--error");
      welcomeTitle.set("Login failed");
      welcomeBody.set("Try demo@jue.dev / letmein.");
    });
}

function resetFeedback() {
  if (loading.get()) {
    return;
  }

  buttonLabel.set("Sign in");
  statusClass.set("my-demo-status my-demo-status--idle");
  statusText.set("Ready");
  welcomeCardClass.set("my-demo-result my-demo-result--idle");
  welcomeTitle.set("No session yet");
  welcomeBody.set("Submit the form to simulate a login request.");
}

function mockLogin(nextEmail: string, nextPassword: string): Promise<{
  name: string;
  role: string;
  source: string;
}> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (nextEmail === "demo@jue.dev" && nextPassword === "letmein") {
        resolve({
          name: "Demo User",
          role: "Workspace Admin",
          source: "mock-auth"
        });
        return;
      }

      reject(new Error("Invalid email or password."));
    }, 650);
  });
}

function func1() {
  console.log("func1");
}

export function App() {
  const pageClass = signal("my-demo-page");
  const shellClass = signal("my-demo-shell");
  const panelClass = signal("my-demo-panel");
  const eyebrow = signal("MOCK AUTH");
  const title = signal("Login Page");
  const emailLabel = signal("Email");
  const passwordLabel = signal("Password");
  const helper = signal("Demo credentials: demo@jue.dev / letmein");
  const buttonClass = signal("my-demo-button");

  return (
    <View className={pageClass.get()}>
      <View className={shellClass.get()}>
        <View className={panelClass.get()}>
          <Text className="my-demo-eyebrow">{eyebrow.get()}</Text>
          <Text className="my-demo-title">{title.get()}</Text>
          <Text className="my-demo-body">{headline.get()}</Text>
          <Text className="my-demo-support">{supportText.get()}</Text>

          <View className="my-demo-field">
            <Text className="my-demo-label">{emailLabel.get()}</Text>
            <Input className="my-demo-input" value={email.get()} onInput={handleEmailInput} />
          </View>

          <View className="my-demo-field">
            <Text className="my-demo-label">{passwordLabel.get()}</Text>
            <Input className="my-demo-input" value={password.get()} onInput={handlePasswordInput} />
          </View>

          <Text className="my-demo-helper">{helper.get()}</Text>
          <Text className={statusClass.get()}>{statusText.get()}</Text>

          <Button className={buttonClass.get()} onPress={handleSubmit}>{buttonLabel.get()}</Button>
          <Button onPress={func1}>123</Button>

          <View className={welcomeCardClass.get()}>
            <Text className="my-demo-result-title">{welcomeTitle.get()}</Text>
            <Text className="my-demo-result-body">{welcomeBody.get()}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
