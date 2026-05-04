export interface DisclosureUnit {
  readonly id: string;
  readonly entry: string;
  readonly layer: string;
  readonly role: string;
}

export interface Container {
  readonly packageId: string;
  readonly path: string;
  readonly containerKind: "pure" | "composite";
  readonly disclosureUnits: DisclosureUnit[];
}

export interface Registry {
  readonly containers: Container[];
}

export interface WorkspacePackage {
  readonly packageId: string;
  readonly path: string;
  readonly manifest: Record<string, unknown>;
}

export interface Edge {
  readonly from: string;
  readonly to: string;
  readonly kind: "dependency" | "devDependency";
}
