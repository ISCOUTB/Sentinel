provider "aws" {
  access_key = var.my_access_key
  secret_key = var.my_secret_key
  region     = var.aws_region
}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.2.0"
}
