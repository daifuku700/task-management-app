terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region     = var.aws_region
  access_key = var.deployment_target == "floci" ? "test" : null
  secret_key = var.deployment_target == "floci" ? "test" : null

  skip_credentials_validation = var.deployment_target == "floci"
  skip_metadata_api_check     = var.deployment_target == "floci"
  skip_requesting_account_id  = var.deployment_target == "floci"
  skip_region_validation      = var.deployment_target == "floci"
  s3_use_path_style           = var.deployment_target == "floci"

  endpoints {
    ec2   = var.deployment_target == "floci" ? var.floci_endpoint : null
    ecs   = var.deployment_target == "floci" ? var.floci_endpoint : null
    ecr   = var.deployment_target == "floci" ? var.floci_endpoint : null
    iam   = var.deployment_target == "floci" ? var.floci_endpoint : null
    sts   = var.deployment_target == "floci" ? var.floci_endpoint : null
    logs  = var.deployment_target == "floci" ? var.floci_endpoint : null
    elbv2 = var.deployment_target == "floci" ? var.floci_endpoint : null
  }
}
