variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "project_name" {
  type    = string
  default = "task-app"
}

variable "deployment_target" {
  type        = string
  default     = "aws"
  description = "Deployment target. Use aws for real AWS and floci for the local Floci emulator."

  validation {
    condition     = contains(["aws", "floci"], var.deployment_target)
    error_message = "deployment_target must be either aws or floci."
  }
}

variable "floci_endpoint" {
  type        = string
  default     = "http://localhost:4566"
  description = "Floci endpoint used when deployment_target is floci."
}

variable "enable_nat_gateway" {
  type        = bool
  default     = true
  description = "Whether to create a NAT Gateway for real AWS deployments. Floci deployments always skip it."
}
