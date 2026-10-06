export const INSTALL = "npm install agentfaces";

export const REACT_QUICK = `import { AgentFace } from "agentfaces/react";

export function AgentStatus() {
  return <AgentFace state="working" shape="circle" color="#2F6BFF" size={48} />;
}`;

export const NATIVE_QUICK = `npm install agentfaces react-native-svg

import { AgentFace } from "agentfaces/react-native";

export function AgentStatus() {
  return <AgentFace state="needs-you" seed={agent.id} size={56} name={agent.name} />;
}`;

export const SVG_QUICK = `import { renderFaceSvg } from "agentfaces/svg";

const svg = renderFaceSvg({ shape: "square", color: "#8B5CF6", state: "done", size: 64 });
document.querySelector("#status").innerHTML = svg;`;

export const PROVIDER = `import { AgentFace, AgentFacesProvider } from "agentfaces/react";

<AgentFacesProvider shapes={["circle", "square"]} palette={["#2F6BFF", "#13B8A7", "#F97216"]} size={40}>
  {agents.map((agent) => (
    <AgentFace key={agent.id} seed={agent.id} name={agent.name} state={agent.state} />
  ))}
</AgentFacesProvider>`;

export const FACE_FOR = `import { faceFor } from "agentfaces";

faceFor("agent-42");
faceFor("agent-42", { shapes: ["triangle"], palette: ["#F6254C", "#20C75E"] });`;
