provider "aws" {
  access_key = var.my_access_key
  secret_key = var.my_secret_key
  region     = var.aws_region
}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.6"
    }
  }
  required_version = ">= 1.2.0"
}
