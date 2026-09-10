<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests;

use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Envelope;

final class EnvelopeTest extends TestCase
{
	public function testAcceptedCarriesTheVersionAndOnlyThePropertiesGiven(): void
	{
		self::assertSame(['formsanity' => 2, 'status' => 'accepted'], Envelope::accepted());
		self::assertSame(['formsanity' => 2, 'status' => 'accepted', 'message' => 'Thanks!'], Envelope::accepted('Thanks!'));
		self::assertSame(['formsanity' => 2, 'status' => 'accepted', 'redirect' => '/welcome'], Envelope::accepted(null, '/welcome'));
	}

	public function testInvalidRequiresAtLeastOneError(): void
	{
		$error = ['field' => 'email', 'code' => 'type.email', 'message' => 'Not a valid email address'];
		self::assertSame(['formsanity' => 2, 'status' => 'invalid', 'errors' => [$error]], Envelope::invalid([$error]));
		$this->expectException(\InvalidArgumentException::class);
		Envelope::invalid([]);
	}

	public function testErrorAndUnique(): void
	{
		self::assertSame(['formsanity' => 2, 'status' => 'error'], Envelope::error());
		self::assertSame(['formsanity' => 2, 'status' => 'error', 'message' => 'Could not store submission'], Envelope::error('Could not store submission'));
		self::assertSame(['formsanity' => 2, 'unique' => false], Envelope::unique(false));
	}

	public function testEnvelopesEncodeAsJsonObjects(): void
	{
		self::assertSame('{"formsanity":2,"status":"accepted"}', json_encode(Envelope::accepted()));
	}
}
